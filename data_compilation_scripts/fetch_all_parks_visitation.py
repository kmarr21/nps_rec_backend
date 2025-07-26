import requests
import json
import xml.etree.ElementTree as ET
import sys
import time
from pathlib import Path

# reads parks.json and gets all park codes from there (the ones we want)
def load_park_codes(parks_file_path):
    try:
        with open(parks_file_path, 'r') as f: parks_data = json.load(f)
        # get park codes from each park entry ("parkCode" field)
        park_codes = []
        for park in parks_data:
            if 'parkCode' in park:
                park_codes.append(park['parkCode'].upper())  #convert to uppercase (is this needed for API?)
        print(f"Found {len(park_codes)} parks in {parks_file_path}")
        return park_codes
    
    except FileNotFoundError:
        print(f"Error: Could not find {parks_file_path}")
        sys.exit(1)
    except json.JSONDecodeError:
        print(f"Error: Could not parse JSON in {parks_file_path}")
        sys.exit(1)

# grab visitation data from NPS stats api (grabs from official public free endpoint that returns xml data)
def fetch_visitation_xml(unit_codes, start_year, start_month, end_year, end_month):
    #official NPS stats api endpoint
    base = "https://irmaservices.nps.gov/Stats/v1/visitation"
    
    # params for api call
    params = {"unitCodes": ",".join(unit_codes), # join multiple park codes with commas
        "startMonth": start_month, "startYear": start_year, "endMonth": end_month, "endYear": end_year}
    
    print(f"Requesting data for {len(unit_codes)} parks: {start_year}-{start_month} to {end_year}-{end_month}")
    
    # make actual HTTP request to the NPS api
    resp = requests.get(base, params=params)
    #debug info
    print(f"HTTP {resp.status_code}: Content-Type: {resp.headers.get('Content-Type')}")
    # throw error if something goes wrong
    resp.raise_for_status()
    # get the response text (will be xml)
    text = resp.text.strip()
    # check actually got data back
    if not text:
        print("Empty response from API")
        return None
    # return results
    return text

# turn XML response and format it 
def parse_visitation_xml(xml_text, years_to_include):
    # got this from raw XML response when I originally pulled it to see formatting (its xmlns="...") (xml namespace)
    ns = {'ns': 'http://schemas.datacontract.org/2004/07/NPS.Stats.Service.Rest.v3'}
    # parse XML string using element tree
    root = ET.fromstring(xml_text)
    parks_data = {} # hold park data organized by park code

    # loop through visitations data elements in the xml & get visitor data for each park for each month
    for vd in root.findall('ns:VisitationData', ns):
        unit = vd.find('ns:UnitCode', ns).text # get park code
        year = int(vd.find('ns:Year', ns).text) #year
        # skip if not for year we want
        if year not in years_to_include: continue
        # get month
        month = int(vd.find('ns:Month', ns).text)
        
        # get visitor counts
        recreation = int(vd.find('ns:RecreationVisitors', ns).text)
        nonrec = int(vd.find('ns:NonRecreationVisitors', ns).text)
        total = recreation + nonrec # and calc total
        
        # organize data by park, then by year
        if unit not in parks_data: parks_data[unit] = {}
        if year not in parks_data[unit]:
            parks_data[unit][year] = {"parkCode": unit, "year": year, "monthly": []}
        
        # add this month's data
        parks_data[unit][year]["monthly"].append({
            "month": f"{year}-{month:02d}",
            "recreation": recreation,
            "nonRecreation": nonrec,
            "totalVisits": total})

    # convert to flat list
    result = []
    for park_code, years_data in parks_data.items():
        for year, year_data in years_data.items():
            # sort monthly data (make sure in order)
            year_data["monthly"].sort(key=lambda x: x["month"])
            result.append(year_data)
    return result

# get visitation data for all parks + years desired
def fetch_all_visitation_data(park_codes, years):
    all_data = []
    # process parks in chunks of 10 (making sure we're batching to not overwhelm the api . . . idk the limits?)
    chunk_size = 10
    
    for i in range(0, len(park_codes), chunk_size):
        chunk = park_codes[i:i + chunk_size]
        print(f"\nProcessing parks {i+1}-{min(i+chunk_size, len(park_codes))} of {len(park_codes)}")
        try:
            # fetch data for this chunk of parks for all years at once
            xml_data = fetch_visitation_xml(unit_codes=chunk, start_year=min(years),
                start_month=1, end_year=max(years), end_month=12)
            
            if xml_data: # parse xml + add to results
                chunk_data = parse_visitation_xml(xml_data, years)
                all_data.extend(chunk_data)
                print(f"Successfully processed {len(chunk_data)} park-year combinations")
            
            # wait a bit between requests . . . (Again, not sure limts on this API?)
            if i + chunk_size < len(park_codes):
                print("Waiting 2 seconds before next request...")
                time.sleep(2)
                
        except Exception as e:
            print(f"Error processing chunk {chunk}: {e}")
            print("Continuing with remaining parks...")
            continue
    
    return all_data

# save data to a JSON file (so we can more easily integrate w/ other parks JSON + build mongoDB)
def save_visitation_data(data, output_path):
    try:
        # create the data directory if doesn't exist
        output_path.parent.mkdir(parents=True, exist_ok=True)
        # write as json
        with open(output_path, 'w') as f: json.dump(data, f, indent=2)
        print(f"\nSuccessfully saved {len(data)} park-year records to {output_path}")
        
        # print some summaries
        parks_count = len(set(record['parkCode'] for record in data))
        years_count = len(set(record['year'] for record in data))
        print(f"Data includes {parks_count} parks across {years_count} years")
        
    except Exception as e:
        print(f"Error saving data to {output_path}: {e}")
        sys.exit(1)

# MAIN: runs process
def main():
    # let user know we're starting the process...
    print("Starting bulk visitation data collection for all national parks...")
    
    # set up file paths relative to the script location
    script_dir = Path(__file__).parent
    parks_file = script_dir.parent/"data"/"parks.json"
    output_file = script_dir.parent/"data"/"park_visitation_data.json"
    target_years = [2022, 2023, 2024] # years we want data for (can change this later if we want more...)
    print(f"Input file: {parks_file}")
    print(f"Output file: {output_file}")
    print(f"Target years: {target_years}")
    
    # load all park codes from the parks.json file
    park_codes = load_park_codes(parks_file)
    
    if not park_codes:
        print("No park codes found in parks.json file")
        sys.exit(1)
    
    # fetch visitation data for all parks + years
    print(f"\nFetching visitation data for {len(park_codes)} parks...")
    visitation_data = fetch_all_visitation_data(park_codes, target_years)
    if not visitation_data:
        print("No visitation data was successfully retrieved")
        sys.exit(1)
    
    # save everything to json file
    save_visitation_data(visitation_data, output_file)
    
    print("\nData collection complete") #mark complete

if __name__ == "__main__":
    main()
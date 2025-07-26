import requests
import json
import xml.etree.ElementTree as ET
import sys

''' What I'm doing in this script:
- making HTTP GET request to NPS stats endpoint (using params to specify what parks, date range I want)
- however, it retuns this info in XML instead of JSON (annoying...); so I'm just using python's XML parser here
to extract visitor #s month by month
- I saw via the reports that NPS is tracking both "recreation" and "nonreaction" visits (researchers maybe?) so we can grab both of these
- then I just convert everything to cleaner JSON with monthly breakdowns so we can use the data more easily
'''

def fetch_visitation_xml(unit_codes, start_year, start_month, end_year, end_month):
    base = "https://irmaservices.nps.gov/Stats/v1/visitation" # official NPS stats endpoint (free one!)
    params = {"unitCodes": ",".join(unit_codes), "startMonth": start_month, "startYear": start_year,
        "endMonth": end_month, "endYear": end_year} # params I'm grabbing to set up the API call
    print(f"Requesting: {base} with {params}")
    resp = requests.get(base, params=params) # make actual HTTP request
    print(f"HTTP {resp.status_code}: Content-Type: {resp.headers.get('Content-Type')}") # see what I get back
    resp.raise_for_status() # raise if something goes wrong...
    text = resp.text.strip() # get response
    # check I actually got something at all:
    if not text:
        print("Empty response -- nothing more to do.")
        sys.exit(1)
    return text # return it if so

# turn XML response and format it 
def parse_visitation_xml(xml_text, target_unit, year):
    ns = {'ns': 'http://schemas.datacontract.org/2004/07/NPS.Stats.Service.Rest.v3'} # got this from raw XML response when I originally pulled it to see formatting (its xmlns="...")
    root = ET.fromstring(xml_text) # parse XML string using element tree
    monthly = [] # to hold monthly visitor data
    # loop through visitations data elements in the xml & get visitor data for each park for each month
    for vd in root.findall('ns:VisitationData', ns):
        unit = vd.find('ns:UnitCode', ns).text #park code!
        yr = int(vd.find('ns:Year', ns).text) #year
        if unit != target_unit or yr != year: continue # skip if not park or year wanted
        month = int(vd.find('ns:Month', ns).text) # get month (1-12 labelled)
        # get numbers for each visitor type and the total:
        recreation = int(vd.find('ns:RecreationVisitors', ns).text) 
        nonrec = int(vd.find('ns:NonRecreationVisitors', ns).text)
        total = recreation + nonrec
        # store in nicer format
        monthly.append({"month": f"{year}-{month:02d}", "recreation": recreation,
            "nonRecreation": nonrec, "totalVisits": total})
    # if no data, print message to inform of this
    if not monthly: print(f"No data for {target_unit} in {year}.")
    return {"parkCode": target_unit, "year": year, "monthly": monthly}

# main: just running this for Olympic National Park (code: OLYM) right now, can change to do multiple
if __name__ == "__main__":
    park = "OLYM"
    year = 2024
    xml = fetch_visitation_xml([park], year, 1, year, 12)
    data = parse_visitation_xml(xml, park, year)
    print(json.dumps(data, indent=2))
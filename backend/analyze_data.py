import csv
import os
from collections import defaultdict
from datetime import datetime

# ======================================================
# CSV FILE PATH
# ======================================================
CSV_PATH = r"D:\downloads\35985678-0d79-46b4-9ed6-6f13308a1d24 (1).csv"

if not os.path.exists(CSV_PATH):
    print("❌ CSV file not found!")
    exit()

print("🔍 Analyzing dataset...\n")

# ======================================================
# VARIABLES
# ======================================================

total_records = 0
empty_state = 0
empty_commodity = 0
zero_price = 0
invalid_dates = 0

state_counts = defaultdict(int)
commodity_counts = defaultdict(int)

unique_states = set()
unique_commodities = set()

earliest_date = None
latest_date = None

# ======================================================
# READ CSV
# ======================================================

with open(CSV_PATH, "r", encoding="utf-8", errors="ignore", newline="") as file:

    reader = csv.DictReader(file)

    print("Detected Columns:")
    print(reader.fieldnames)
    print("-" * 60)

    for row in reader:

        total_records += 1

        # Remove spaces from keys and values
        clean_row = {}

        for k, v in row.items():
            key = k.strip() if k else ""
            value = v.strip() if isinstance(v, str) else v
            clean_row[key] = value

        state = clean_row.get("State", "")
        commodity = clean_row.get("Commodity", "")
        arrival_date = clean_row.get("Arrival_Date", "")
        price = clean_row.get("Modal_Price", "0")

        # ------------------------
        # State
        # ------------------------
        if state:
            unique_states.add(state)
            state_counts[state] += 1
        else:
            empty_state += 1

        # ------------------------
        # Commodity
        # ------------------------
        if commodity:
            unique_commodities.add(commodity)
            commodity_counts[commodity] += 1
        else:
            empty_commodity += 1

        # ------------------------
        # Price
        # ------------------------
        try:
            modal_price = float(str(price).replace(",", ""))
            if modal_price <= 0:
                zero_price += 1
        except:
            zero_price += 1

        # ------------------------
        # Date
        # ------------------------
        if arrival_date:

            try:
                current_date = datetime.strptime(arrival_date, "%d-%m-%Y")

                if earliest_date is None or current_date < earliest_date:
                    earliest_date = current_date

                if latest_date is None or current_date > latest_date:
                    latest_date = current_date

            except Exception:
                invalid_dates += 1

        if total_records % 100000 == 0:
            print(f"Processed {total_records:,} records...")

# ======================================================
# REPORT
# ======================================================

print("\n" + "=" * 70)
print("📊 DATASET ANALYSIS REPORT")
print("=" * 70)

print(f"Total Records              : {total_records:,}")
print(f"Empty State Rows           : {empty_state:,}")
print(f"Empty Commodity Rows       : {empty_commodity:,}")
print(f"Zero Price Rows            : {zero_price:,}")
print(f"Invalid Date Rows          : {invalid_dates:,}")

print("\n📅 DATE RANGE")
print("-" * 70)

if earliest_date:
    print("Earliest Date :", earliest_date.strftime("%d-%m-%Y"))
    print("Latest Date   :", latest_date.strftime("%d-%m-%Y"))
else:
    print("No valid dates found!")

print("\n🗺️ UNIQUE STATES")
print("-" * 70)

for state in sorted(unique_states):
    print(state)

print(f"\nTotal Unique States : {len(unique_states)}")

print("\n🌾 UNIQUE COMMODITIES")
print("-" * 70)

for commodity in sorted(unique_commodities):
    print(commodity)

print(f"\nTotal Unique Commodities : {len(unique_commodities)}")

print("\n🏆 TOP 10 STATES")
print("-" * 70)

for state, count in sorted(state_counts.items(), key=lambda x: x[1], reverse=True)[:10]:
    print(f"{state:<35} {count:,}")

print("\n🏆 TOP 15 COMMODITIES")
print("-" * 70)

for commodity, count in sorted(commodity_counts.items(), key=lambda x: x[1], reverse=True)[:15]:
    print(f"{commodity:<40} {count:,}")

print("\n✅ Analysis Complete!")
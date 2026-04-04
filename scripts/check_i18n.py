import json
import os
import sys

def get_keys(data, prefix=""):
    keys = set()
    for k, v in data.items():
        full_key = f"{prefix}.{k}" if prefix else k
        if isinstance(v, dict):
            keys.update(get_keys(v, full_key))
        else:
            keys.add(full_key)
    return keys

def main():
    base_dir = "src/i18n"
    locales = ["en.json", "fr.json", "he.json"]
    
    all_keys = {}
    for loc in locales:
        p = os.path.join(base_dir, loc)
        if not os.path.exists(p):
            print(f"File {p} missing!")
            continue
        with open(p, "r", encoding="utf-8") as f:
            data = json.load(f)
            all_keys[loc] = get_keys(data)
            print(f"Loaded {len(all_keys[loc])} keys from {loc}")

    master_loc = "en.json"
    master_keys = all_keys[master_loc]
    
    missing_total = 0
    for loc in locales:
        if loc == master_loc:
            continue
        
        my_keys = all_keys[loc]
        missing = master_keys - my_keys
        extra = my_keys - master_keys
        
        if missing:
            print(f"\n[{loc}] Missing {len(missing)} keys:")
            for mk in sorted(missing):
                print(f"  - {mk}")
            missing_total += len(missing)
        
        if extra:
            print(f"\n[{loc}] Extra {len(extra)} keys (not in {master_loc}):")
            for ek in sorted(extra):
                print(f"  - {ek}")

    if missing_total > 0:
        print(f"\nTotal missing translates: {missing_total}")
        sys.exit(1)
    else:
        print("\nAll translation files are consistent!")
        sys.exit(0)

if __name__ == "__main__":
    main()

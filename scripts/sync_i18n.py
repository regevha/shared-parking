import json
import os

def sync_dict(master, target):
    new_dict = {}
    for k, v in master.items():
        if isinstance(v, dict):
            # Recurse
            target_val = target.get(k, {}) if isinstance(target.get(k), dict) else {}
            new_dict[k] = sync_dict(v, target_val)
        else:
            # Leaf node: preserve target value if exists, else use master
            new_dict[k] = target.get(k, v)
    return new_dict

def main():
    base_dir = "src/i18n"
    master_file = os.path.join(base_dir, "en.json")
    targets = ["fr.json", "he.json"]
    
    with open(master_file, "r", encoding="utf-8") as f:
        master_data = json.load(f)

    for t_filename in targets:
        t_path = os.path.join(base_dir, t_filename)
        t_data = {}
        if os.path.exists(t_path):
            with open(t_path, "r", encoding="utf-8") as f:
                try:
                    t_data = json.load(f)
                except:
                    t_data = {}
        
        synced_data = sync_dict(master_data, t_data)
        
        with open(t_path, "w", encoding="utf-8") as f:
            json.dump(synced_data, f, indent=2, ensure_ascii=False)
        print(f"Synced {t_filename} against en.json")

if __name__ == "__main__":
    main()

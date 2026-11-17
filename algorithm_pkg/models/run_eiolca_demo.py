import json
from models.eiolca import calculate_demo_bom
if __name__ == "__main__":
    print(json.dumps(calculate_demo_bom(), ensure_ascii=False, indent=2))

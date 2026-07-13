import os
import re

test_dir = r"D:\voltium\flutter\integration_test\e2e_individual"

key_mapping = {
    "preDashboard": "app.dashboard.preDashboardScreen",
    "dashboard": "app.dashboard.dashboardTab",
    "intent": "app.onboarding.deliverWithUsCard",
    "userForm": "app.onboarding.fullNameField",
    "topUpReceipt": "app.wallet.topUpReceipt",
    "choosePlan": "app.dashboard.choosePlan",
    "pickupHub": "app.dashboard.pickupHub",
}

def refactor_file(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    def replacer(match):
        key = match.group(2)
        if key in key_mapping:
            return key_mapping[key]
        return f"app.shared.{key}"

    new_content = re.sub(r"find\.byKey\((const )?ValueKey\('([^']+)'\)\)", replacer, content)
    
    if new_content != content:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print("Updated", file_path)

for f in os.listdir(test_dir):
    if f.endswith(".dart"):
        refactor_file(os.path.join(test_dir, f))

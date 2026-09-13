import re

with open("app/api/routes.py", "r", encoding="utf-8") as f:
    text = f.read()

replacement1 = """
    anomaly_count = 0
    for line in all_lines:
        entries = list(db.spend_entries.find({"budget_line_id": line["id"]}).sort("period", 1))
        actual = sum(e["amount_spent"] for e in entries)
        line["remaining_budget"] = line.get("allocated_amount", 0.0) - actual
        
        if entries and detect_velocity_anomaly([e["amount_spent"] for e in entries]).detected:
            anomaly_count += 1
"""
text = re.sub(r"\n\s+anomaly_count = 0.*?(?=\n\s+dept_outs = \[\])", replacement1, text, flags=re.DOTALL)

replacement2 = """
    for d in depts:
        d_lines = [l for l in all_lines if l.get("department_id") == d["id"]]
        for line in d_lines:
            entries = list(db.spend_entries.find({"budget_line_id": line["id"]}))
            line["remaining_budget"] = line.get("allocated_amount", 0.0) - sum(e["amount_spent"] for e in entries)
        dout = DepartmentOut(**d, budget_lines=d_lines)
        dept_outs.append(dout)
"""
text = re.sub(r"\n\s+for d in depts:.*?(?=\n\s+return dept_outs)", replacement2, text, flags=re.DOTALL)

val_insert = """
    if f"{guardrails.transfer:,.0f}" not in reasoning.recommendation and str(int(guardrails.transfer)) not in reasoning.recommendation:
        reasoning.recommendation += f" [Validated Transfer Amount: {guardrails.transfer}]"
        
    rec = {"""
text = text.replace("    rec = {", val_insert)

text = text.replace(
    '"amount": rec["amount"],\n            "source_new_remaining": source.get("remaining_budget", 0) - rec["amount"],\n            "target_new_remaining": target.get("remaining_budget", 0) + rec["amount"],',
    '"amount": rec["amount"],\n            "previous_source_budget": source.get("remaining_budget", 0),\n            "new_source_budget": source.get("remaining_budget", 0) - rec["amount"],\n            "previous_target_budget": target.get("remaining_budget", 0),\n            "new_target_budget": target.get("remaining_budget", 0) + rec["amount"],'
)

text = text.replace(
    '{"original_amount": rec["amount"], "modified_amount": req.amount}',
    '{\n            "original_amount": rec["amount"],\n            "modified_amount": req.amount,\n            "previous_source_budget": source.get("remaining_budget", 0),\n            "new_source_budget": source.get("remaining_budget", 0) - req.amount,\n            "previous_target_budget": target.get("remaining_budget", 0),\n            "new_target_budget": target.get("remaining_budget", 0) + req.amount\n        }'
)

text = text.replace(
    '{"reason": req.reason}',
    '{\n            "reason": req.reason,\n            "previous_source_budget": 0,\n            "new_source_budget": 0,\n            "previous_target_budget": 0,\n            "new_target_budget": 0\n        }'
)

with open("app/api/routes.py", "w", encoding="utf-8") as f:
    f.write(text)

import pandas as pd
import json
import os

file_path = r"C:\Users\Professor\Desktop\apex\assets\excel\LME (version 1) (version 1).xlsx"
df = pd.read_excel(file_path, sheet_name='TABELA LME ')

blocks = []

def clean_val(val):
    if pd.isna(val):
        return None
    s = str(val).strip().lower()
    if 'feriado' in s:
        return 'feriado'
    s = s.replace('r$', '').replace('%', '').replace(' ', '')
    if ',' in s and '.' in s:
        s = s.replace('.', '').replace(',', '.')
    elif ',' in s:
        s = s.replace(',', '.')
    try:
        return float(s)
    except ValueError:
        return str(val).strip()

def parse_date(val):
    if pd.isna(val):
        return None
    if hasattr(val, 'strftime'):
        return val.strftime('%d/%m/%Y')
    s = str(val).strip()
    return s

for r in range(len(df)):
    c5 = str(df.iloc[r, 5]).strip() if pd.notna(df.iloc[r, 5]) else ""
    c7 = str(df.iloc[r, 7]).strip() if pd.notna(df.iloc[r, 7]) else ""
    
    if c5 == "DATA" and c7 == "COBRE":
        days = []
        for i in range(1, 6):
            row_idx = r + i
            if row_idx >= len(df):
                break
            
            day_data = {
                'data': parse_date(df.iloc[row_idx, 5]),
                'cobre': clean_val(df.iloc[row_idx, 7]),
                'zinco': clean_val(df.iloc[row_idx, 9]),
                'aluminio': clean_val(df.iloc[row_idx, 11]),
                'chumbo': clean_val(df.iloc[row_idx, 13]),
                'estanho': clean_val(df.iloc[row_idx, 15]),
                'niquel': clean_val(df.iloc[row_idx, 17]),
                'dolar': clean_val(df.iloc[row_idx, 19]),
            }
            days.append(day_data)
            
        computed = {}
        for j in range(6, 20):
            row_idx = r + j
            if row_idx >= len(df):
                break
            label = str(df.iloc[row_idx, 5]).strip() if pd.notna(df.iloc[row_idx, 5]) else ""
            if label in ["MEDIA SEMANAL", "100% LME", "SEMANA ANTERIOR", "FECHAMENTO % ( SEMANA ANTERIOR )", "OSCILAÇÃO %", "OSCILAÇÃO R$", "MEDIA MENSAL"]:
                row_vals = {
                    'cobre': clean_val(df.iloc[row_idx, 7]),
                    'zinco': clean_val(df.iloc[row_idx, 9]),
                    'aluminio': clean_val(df.iloc[row_idx, 11]),
                    'chumbo': clean_val(df.iloc[row_idx, 13]),
                    'estanho': clean_val(df.iloc[row_idx, 15]),
                    'niquel': clean_val(df.iloc[row_idx, 17]),
                    'dolar': clean_val(df.iloc[row_idx, 19]),
                }
                computed[label] = row_vals
                
        blocks.append({
            'row_index': r,
            'header': days[0]['data'] if days else 'N/A',
            'days': days,
            'computed': computed
        })

output_dir = r"C:\Users\Professor\Desktop\apex\assets\excel"
os.makedirs(output_dir, exist_ok=True)
output_path = os.path.join(output_dir, "lme_parsed.json")

with open(output_path, "w", encoding="utf-8") as f:
    json.dump(blocks, f, indent=4, ensure_ascii=False)
print("Saved all blocks to lme_parsed.json")

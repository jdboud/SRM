import pandas as pd

def read_excel(file_path):
    df = pd.read_excel(file_path)
    data = df.to_dict(orient='records')
    return data

if __name__ == '__main__':
    file_path = '/Users/J-D/Documents/ART/INPROGRESS/024artolog/NBCCPracticum024/repositorySRMhtml5JDB024/binaryCleanUserNumberCollections1Test024.xlsx'
    data = read_excel(file_path)
    with open('data.json', 'w') as f:
        import json
        json.dump(data, f, indent=4)

import os, re

template_dir = r"c:\Tec\6to Semestre\Ingenieria De Software\Proyecto TravelWhisly\templates"

for root, _, files in os.walk(template_dir):
    for f in files:
        if f.endswith('.html'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as file:
                content = file.read()
            # revertir
            content = re.sub(r"url_for\('auth\.", "url_for('", content)
            content = re.sub(r'url_for\("auth\.', 'url_for("', content)
            content = re.sub(r"url_for\('main\.", "url_for('", content)
            content = re.sub(r'url_for\("main\.', 'url_for("', content)
            content = re.sub(r"url_for\('api\.", "url_for('", content)
            content = re.sub(r'url_for\("api\.', 'url_for("', content)
            
            with open(path, 'w', encoding='utf-8') as file:
                file.write(content)

print("Templates revertidos a su estado funcional original")

import os, re

template_dir = r"c:\Tec\6to Semestre\Ingenieria De Software\Proyecto TravelWhisly\templates"

auth_routes = ['registro', 'login', 'magic_login', 'magic_auth', 'reset_password', 'reset_with_token', 'logout']
main_routes = ['index', 'dashboard', 'constructor', 'financiamiento', 'guia', 'historial']
api_routes = ['api_check_session', 'save_route', 'delete_route', 'save_savings_plan', 'get_savings_plans', 'delete_savings_plan', 'get_route', 'api_weather', 'api_exchange']

def replace_endpoints(content):
    # Ya que "index" podría estar dentro de auth.index y main.index, hay que cuidarlo
    for r in auth_routes:
        content = re.sub(rf"url_for\(\s*'{r}'", f"url_for('auth.{r}'", content)
        content = re.sub(rf'url_for\(\s*"{r}"', f'url_for("auth.{r}"', content)
    for r in main_routes:
        content = re.sub(rf"url_for\(\s*'{r}'", f"url_for('main.{r}'", content)
        content = re.sub(rf'url_for\(\s*"{r}"', f'url_for("main.{r}"', content)
    for r in api_routes:
        content = re.sub(rf"url_for\(\s*'{r}'", f"url_for('api.{r}'", content)
        content = re.sub(rf'url_for\(\s*"{r}"', f'url_for("api.{r}"', content)
    return content

for root, _, files in os.walk(template_dir):
    for f in files:
        if f.endswith('.html'):
            path = os.path.join(root, f)
            with open(path, 'r', encoding='utf-8') as file:
                content = file.read()
            new_content = replace_endpoints(content)
            with open(path, 'w', encoding='utf-8') as file:
                file.write(new_content)

print("Templates actualizados exitosamente")

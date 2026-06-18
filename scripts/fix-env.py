import os

secret = "GOCSPX-" + "nPLAJAoQOO4vY12xteYN5hD7S3Z4"

env_path = os.path.join(os.path.dirname(__file__), '..', '.env')
env_path = os.path.normpath(env_path)

with open(env_path, 'r') as f:
    content = f.read()

# Find and replace the GOOGLE_CLIENT_SECRET line
lines = content.split('\n')
new_lines = []
for line in lines:
    if line.startswith('GOO...nv'):
        new_lines.append(f'GOO...nv')
    else:
        new_lines.append(line)

with open(env_path, 'w') as f:
    f.write('\n'.join(new_lines))

print(f"Updated GOOGLE_CLIENT_SECRET to: {secret}")

import re

with open('.env', 'r') as f:
    content = f.read()

old = 'GOODRIVE_FOLDER_ID'
new = 'GOOGLE_DRIVE_FOLDER_ID'

# Replace the malformed line
lines = content.split('\n')
out = []
for line in lines:
    if line.startswith(old):
        out.append(new + '=1SnNyENp3FpDmhIu57V2mbizKy_oQNEsX')
    else:
        out.append(line)

with open('.env', 'w') as f:
    f.write('\n'.join(out))

print('Fixed GOOGLE_DRIVE_FOLDER_ID')

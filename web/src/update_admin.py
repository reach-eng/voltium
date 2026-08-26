import os
import re

updates = {
    r'd:\voltium\web\src\app\api\admin\admins\route.ts': [
        (r'const updateData: any = \{ \.\.\.data \};', r'const updateData: Prisma.AdminUpdateInput = { ...data };')
    ],
    r'd:\voltium\web\src\app\api\admin\guarantors\route.ts': [
        (r'const where: any = \{\};', r'const where: Prisma.GuarantorWhereInput = {};')
    ],
    r'd:\voltium\web\src\app\api\admin\kyc\route.ts': [
        (r'const where: any = \{\};', r'const where: Prisma.KycWhereInput = {};')
    ],
    r'd:\voltium\web\src\app\api\admin\rentals\route.ts': [
        (r'const where: any = \{\};', r'const where: Prisma.RentalWhereInput = {};')
    ],
    r'd:\voltium\web\src\app\api\admin\riders\actions\route.ts': [
        (r'const dbUpdate: any = \{\};', r'const dbUpdate: Prisma.RiderUpdateInput = {};')
    ],
    r'd:\voltium\web\src\app\api\admin\jobs\route.ts': [
        (r'let result: any = null;', r'let result: unknown = null;')
    ]
}

for filepath, file_updates in updates.items():
    if not os.path.exists(filepath):
        print(f'File not found: {filepath}')
        continue
    
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    new_content = content
    for pattern, replacement in file_updates:
        new_content = re.sub(pattern, replacement, new_content)

    if 'Prisma.' in new_content and 'import { Prisma }' not in new_content:
        # Add import at the top
        new_content = "import { Prisma } from '@prisma/client';\n" + new_content

    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f'Updated {filepath}')

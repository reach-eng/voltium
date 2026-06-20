import fs from 'fs';
import path from 'path';

describe('Admin UI Components Connectivity', () => {
  it('verifies UI screen component files exist on disk', () => {
    const root = path.resolve(__dirname, '../../src/components/admin');
    
    expect(fs.existsSync(path.join(root, 'AdminLayout.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'AdminSidebar.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'screens/FeatureFlagsScreen.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'screens/DeviceTrackingView.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'screens/KycManagement.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'screens/RiderManagement.tsx'))).toBe(true);
  });
});

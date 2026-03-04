const { execSync } = require('child_process');
const path = require('path');

exports.default = async function(context) {
  // Only run on macOS builds
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`);
  
  console.log(`Ad-hoc signing: ${appPath}`);
  
  try {
    execSync(`codesign --force --deep --sign - "${appPath}"`, { stdio: 'inherit' });
    console.log('Ad-hoc signing completed successfully');
  } catch (error) {
    console.error('Ad-hoc signing failed:', error.message);
    // Don't fail the build, just warn
  }
};

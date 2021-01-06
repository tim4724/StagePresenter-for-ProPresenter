start:
	npm start

package:
	electron-packager . --overwrite --icon icon.icns

packageAll:
	electron-packager .  --platform=all --arch=x64 --overwrite --icon icon.icns

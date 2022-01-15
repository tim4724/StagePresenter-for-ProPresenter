install:
	cd stagepresenter && npm install

start:
	npm start --prefix stagepresenter --unhandled-rejections=strict

clean:
	rm -r build

package: icns
	electron-packager stagepresenter --overwrite --icon build/icon.icns \
		--app-bundle-id="com.stagepresenter" \
		--out "build"

microsoftStore: ico
	@echo "--- Installing required npm modules  ---"
	npm i -g electron-packager electron-windows-store
	@echo "--- Packaging x64 application ---"
	electron-packager stagepresenter --overwrite --icon build/icon.ico \
		--app-bundle-id="com.stagepresenter" \
		--out "build"
	@echo "--- Creating appx for Microsoft Store ---"
	electron-windows-store --input-directory build\StagePresenter-win32-x64 --output-directory build \
		--windows-kit "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22000.0\x64" \
		--desktop-converter undefined --package-name "StagePresenter" --publisher CN=timvogel --dev-cert undefined 

appstore: icns
	@echo "--- Installing required npm modules  ---"
	npm i -g electron-packager electron-osx-sign
	cd build && npm i @electron/universal
	@echo "--- Packaging x64 application ---"
	electron-packager stagepresenter \
		--platform=mas \
		--arch=x64 \
		--overwrite \
		--icon build/icon.icns \
		--app-bundle-id="com.stagepresenter" \
		--out "build"
	@echo "--- Packaging arm64 application ---"
	electron-packager stagepresenter  \
		--platform=mas \
		--arch=arm64 \
		--overwrite \
		--icon build/icon.icns \
		--app-bundle-id="com.stagepresenter" \
		--out "build"
	@echo "--- Merge x64 and arm64 application ---"
	cd build && node -e "async function main() {await require('@electron/universal').makeUniversalApp({ \
		x64AppPath: process.cwd() + '/StagePresenter-mas-x64/StagePresenter.app', \
		arm64AppPath: process.cwd() + '/StagePresenter-mas-arm64/StagePresenter.app', \
		outAppPath: process.cwd() + '/StagePresenter-mas-universal/StagePresenter.app', \
		force: true})}; main();"
	@echo "--- Signing universal application ---"
	electron-osx-sign "build/StagePresenter-mas-universal/StagePresenter.app" \
		--platform=mas \
		--type=distribution \
		--entitlements="entitlements.mas.plist" \
		--provisioning-profile="StagePresenter_AppStore.provisionprofile"
	@echo "--- Creating signed installer for universal application ---"
	productbuild --component "build/StagePresenter-mas-universal/StagePresenter.app" \
		/Applications \
		--sign "3rd Party Mac Developer Installer: Tim Vogel (5ZH48MPAM3)" \
		"build/StagePresenter-mas-universal/StagePresenter.pkg"
	@echo "--- Remove node_modules and package json in dir build ---"
		rm -r build/node_modules
		rm build/package.json
		rm build/package-lock.json
	@echo "--- Remove icon files in dir build ---"
		rm -r build/icon.iconset
		rm build/icon.icns
	@echo "--- Remove temp mas builds ---"
		rm -r build/StagePresenter-mas-arm64
		rm -r build/StagePresenter-mas-x64

verify_appstore:
	codesign -dv -r- "build/StagePresenter-mas-universal/StagePresenter.app"
	@echo ""
	codesign -vvv "build/StagePresenter-mas-universal/StagePresenter.app"
	@echo ""

icns:
	@echo "--- Creating iconset and icns icon ---"
	mkdir -p build/icon.iconset/
	rm -rf build/icon.iconset/*
	convert icon.png -resize 1024x1024 build/icon.iconset/icon512x512@2x.png
	convert icon.png -resize 512x512 build/icon.iconset/icon512x512.png
	iconutil -c icns build/icon.iconset

ico:
	mkdir build
	magick convert icon.png -define icon:auto-resize=256,128,64,32,16 "build/icon.ico"

favicon:
	magick convert icon.png -crop 896x896+64+64 -define icon:auto-resize=256,128,64,32,16 "www/favicon.ico"

resize:
	magick convert readme_res/StagePresenter_Welcome_mac.png -resize 2880x1800 readme_res/StagePresenter_Welcome_mac.png
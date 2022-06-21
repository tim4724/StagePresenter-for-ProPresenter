APPSTORE_PROV_PROFILE=StagePresenter_AppStore.provisionprofile
APPSTORE_APP_IDENTITY=3rd Party Mac Developer Application: Tim Vogel (5ZH48MPAM3)
APPSTORE_INST_IDENTITY=3rd Party Mac Developer Installer: Tim Vogel (5ZH48MPAM3)
WINDOWS_MAKEAPPX_PATH=C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64
WINDOWS_APPX_PUBLISHER=CN=timvogel

install:
	cd stagepresenter && npm install

start:
	npm start --prefix stagepresenter --unhandled-rejections=strict

clean:
	rm -r build

package: icns
	npm i --location=global electron-packager 
	electron-packager stagepresenter --overwrite --icon build/icon.icns --app-bundle-id="com.stagepresenter" --out "build"

windows_pfx:
	if not exist build mkdir build
	: Create CFX
	: https://docs.microsoft.com/de-de/windows/win32/appxpkg/how-to-create-a-package-signing-certificate
	cd build && MakeCert /n $(WINDOWS_APPX_PUBLISHER) /r /h 0 /eku "1.3.6.1.5.5.7.3.3,1.3.6.1.4.1.311.10.3.13" /e "01/01/2040" /sv MyKey.pvk MyKey.cer
	cd build && Pvk2Pfx /pvk MyKey.pvk /spc MyKey.cer /pfx MyKey.pfx
	: Install CFX
	: https://stackoverflow.com/questions/23812471/installing-appx-without-trusted-certificate

microsoftStore: ico
	@echo "--- Installing required npm modules  ---"
	npm i --location=global electron-packager electron-windows-store
	@echo "--- Packaging x64 application ---"
	electron-packager stagepresenter \
		--overwrite \
		--icon build/icon.ico \
		--app-bundle-id="com.stagepresenter" \
		--out "build"
	@echo "--- Creating appx for Microsoft Store ---"
	: Make-Pri required to have an unplated taskbar icon
	electron-windows-store \
		--input-directory build\StagePresenter-win32-x64 \
		--output-directory build \
		--package-version 1.0.0.0 \
		--assets "build/assets" \
 		--package-name "StagePresenter" \
		--package-description "Stage Display for ProPresenter" \
		--package-background-color "#4497f8" \
		--windows-kit "$(WINDOWS_MAKEAPPX_PATH)" \
		--desktop-converter undefined \
		--publisher $(WINDOWS_APPX_PUBLISHER) \
		--make-pri true \
		--dev-cert build\MyKey.pfx

appstore: icns
	@echo "--- Installing required npm modules  ---"
	npm i --location=global electron-packager electron-osx-sign
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
		--identity="$(APPSTORE_APP_IDENTITY)" \
		--provisioning-profile=$(APPSTORE_PROV_PROFILE)
	@echo "--- Creating signed installer for universal application ---"
	productbuild --component "build/StagePresenter-mas-universal/StagePresenter.app" \
		/Applications \
		--sign "$(APPSTORE_INST_IDENTITY)" \
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
	: Unplated Icon for taskbar https://docs.microsoft.com/en-us/windows/msix/desktop/desktop-to-uwp-manual-conversion
	if not exist build\assets mkdir build\assets
	magick convert icon.png -define icon:auto-resize=256,128,64,32,16 "build/icon.ico"
	magick convert icon.png -resize 256x256 "build/assets/SampleAppx.44x44.png"
	magick convert icon.png -resize 256x256 "build/assets/SampleAppx.44x44.targetsize-44_altform-unplated.png"
	magick convert icon.png -resize 256x256 "build/assets/SampleAppx.50x50.png"
	magick convert icon.png -resize 256x256 "build/assets/SampleAppx.150x150.png"
	magick convert icon.png -resize 310x150 -border 80x0 "build/assets/SampleAppx.310x150.png"

favicon:
	magick convert icon.png -crop 896x896+64+64 -define icon:auto-resize=256,128,64,32,16 "www/favicon.ico"

resize:
	magick convert readme_res/StagePresenter_Welcome_mac.png -resize 2880x1800 readme_res/StagePresenter_Welcome_mac.png
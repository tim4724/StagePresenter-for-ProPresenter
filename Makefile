start:
	npm start --prefix stagepresenter

package: icns
	electron-packager stagepresenter --overwrite --icon build/icon.icns \
		--app-bundle-id="com.stagepresenter" \
		--out "build"

packageAll: icns
	electron-packager stagepresenter  --platform=all --arch=x64 --overwrite \
		--icon build/icon.icns \
		--app-bundle-id="com.stagepresenter" \
		--out "build"

development: icns
	@echo "--- Packaging x64 application ---"
	electron-packager stagepresenter  --platform=darwin --arch=x64 --overwrite \
		--icon build/icon.icns \
		--app-bundle-id="com.stagepresenter" \
		--out "build"
	@echo "--- Packaging arm64 application ---"
	electron-packager stagepresenter  --platform=darwin --arch=arm64 --overwrite \
		--icon build/icon.icns \
		--app-bundle-id="com.stagepresenter" \
		--out "build"
	@echo "--- Merge x64 and arm64 application ---"
	node -e "async function main() {await require('@electron/universal').makeUniversalApp({ \
			x64AppPath: process.cwd() + '/build/StagePresenter-darwin-x64/StagePresenter.app', \
			arm64AppPath: process.cwd() + '/build/StagePresenter-darwin-arm64/StagePresenter.app', \
			outAppPath: process.cwd() + '/build/StagePresenter-darwin-universal/StagePresenter.app', \
			force: true})}; main();"
	@echo "--- Signing universal application ---"
	electron-osx-sign "build/StagePresenter-darwin-universal/StagePresenter.app" \
		--platform=darwin \
		--type=development \
		--provisioning-profile="StagePresenter_Development_Tims_MacBook_Pro.provisionprofile"

appstore: icns
	@echo "--- Packaging x64 application ---"
	electron-packager stagepresenter  --platform=mas --arch=x64 --overwrite \
		--icon build/icon.icns \
		--app-bundle-id="com.stagepresenter" \
		--out "build"
	@echo "--- Packaging arm64 application ---"
	electron-packager stagepresenter  --platform=mas --arch=arm64 --overwrite \
		--icon build/icon.icns \
		--app-bundle-id="com.stagepresenter" \
		--out "build"
	@echo "--- Merge x64 and arm64 application ---"
	node -e "async function main() {await require('@electron/universal').makeUniversalApp({ \
			x64AppPath: process.cwd() + '/build/StagePresenter-mas-x64/StagePresenter.app', \
			arm64AppPath: process.cwd() + '/build/StagePresenter-mas-arm64/StagePresenter.app', \
			outAppPath: process.cwd() + '/build/StagePresenter-mas-universal/StagePresenter.app', \
			force: true})}; main();"
	@echo "--- Signing universal application ---"
	electron-osx-sign "build/StagePresenter-mas-universal/StagePresenter.app" \
		--platform=mas \
		--type=distribution \
		--hardened-runtime \
		--entitlements="entitlements.mas.plist" \
		--provisioning-profile="StagePresenter_AppStore.provisionprofile"
	@echo "--- Creating signed installer for universal application ---"
	productbuild --component "build/StagePresenter-mas-universal/StagePresenter.app" \
		/Applications \
		--sign "3rd Party Mac Developer Installer: Tim Vogel (5ZH48MPAM3)" \
		"build/StagePresenter-mas-universal/StagePresenter.pkg"

icns:
	@echo "--- Creating iconset and icns icon ---"
	mkdir -p build/icon.iconset/
	rm -rf build/icon.iconset/*
	convert icon.png -resize 1024x1024 build/icon.iconset/icon512x512@2x.png
	convert icon.png -resize 512x512 build/icon.iconset/icon512x512.png
	iconutil -c icns build/icon.iconset

favicon:
	convert icon.png -crop 896x896+64+64 -define icon:auto-resize=256,128,64,32,16 "www/favicon.ico"

resize:
	convert readme_res/StagePresenter_Welcome_mac.png -resize 2880x1800 readme_res/StagePresenter_Welcome_mac.png

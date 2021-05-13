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

appstore: icns
	rm -rf build/icon.iconset/
	mkdir build/icon.iconset/
	convert icon.png -resize 1024x1024 build/icon.iconset/icon512x512@2x.png
	convert icon.png -resize 512x512 build/icon.iconset/icon512x512.png
	iconutil -c icns build/icon.iconset
	@echo "--- Packaging x64 application ---"
	electron-packager stagepresenter  --platform=mas --arch=x64 --overwrite \
		--icon build/icon.icns \
		--app-bundle-id="com.stagepresenter" \
		--out "build"
	@echo "--- Signing x64 application ---"
	electron-osx-sign "build/StagePresenter-mas-x64/StagePresenter.app" \
		--platform=mas \
		--type=distribution \
		--entitlements="entitlements.mas.plist" \
		--provisioning-profile="StagePresenter_AppStore.provisionprofile"
	@echo "--- Creating x64 signed installer ---"
	productbuild --component "build/StagePresenter-mas-x64/StagePresenter.app" \
		/Applications \
		--sign "3rd Party Mac Developer Installer: Tim Vogel (5ZH48MPAM3)" \
		"build/StagePresenter-mas-x64/StagePresenter.pkg"

icns:
	@echo "--- Creating iconset and icns icon ---"
	mkdir -p build/icon.iconset/
	rm -rf build/icon.iconset/*
	convert icon.png -resize 1024x1024 build/icon.iconset/icon512x512@2x.png
	convert icon.png -resize 512x512 build/icon.iconset/icon512x512.png
	iconutil -c icns build/icon.iconset

resize:
	# convert readme_res/StagePresenter_Portrait.png -resize 2880x1800 readme_res/StagePresenter_Portrait.png

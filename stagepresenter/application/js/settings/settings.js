function Settings() {
	function toggleSettingGroupHelp(settingGroupHelpContainerElement) {
		const settingGroupHelpElement = settingGroupHelpContainerElement.querySelector('.settingGroupHelp')
		if (settingGroupHelpElement.style.display != "block") {
			hideAllHelps()
			settingGroupHelpElement.style.display = "block";
		} else {
			hideAllHelps()
		}
	}

	function hideAllHelps() {
		const settingGroupHelpElements = document.querySelectorAll('.settingGroupHelp')
		settingGroupHelpElements.forEach(e => e.style.display = "none")
	}

	return {
		toggleSettingGroupHelp: toggleSettingGroupHelp,
		hideAllHelps: hideAllHelps
	}
}

# Tips and Tricks for StagePresenter


## Slide Labels with special Effect

Add one of the following labels to a slide to override how a presentation is displayed in StagePresenter.

<img src="/readme_res/ProPresenter_add_label.png?raw=true" width="600" />

### Show the Preview Image of a Slide in StagePresenter

| ProPresenter Slide Label              | Effect on StagePresenter                                           |
|---------------------------------------|--------------------------------------------------------------------|
| `$stagepresenter:showImage`           | Show the preview image of the slide instead of the slide text.     |
| `$stagepresenter:showImageLarger`     | Show a large preview image of the slide instead of the slide text. |
| `$stagepresenter:showImageFullscreen` | Show a fullscreen preview image of the slide instead of the text.  |

### Change which Text of a Slide is shown in StagePresenter

| ProPresenter Slide Label               | Effect on StagePresenter                                                                                            |
|----------------------------------------|---------------------------------------------------------------------------------------------------------------------|
| `$stagepresenter:showAllTextBoxes`     | Show the text from all textboxes of a slide. Ignoring "Only include the first Textbox of a Slide" in settings.      |
| `$stagepresenter:showOnlyFirstTextBox` | Show only text from the first textbox of a slide. Ignoring "Only include the first Textbox of a Slide" in settings. |
| `$stagepresenter:keepLineBreaks`       | Keep the linebreaks in the text of the slide. Ignoring "Auto-Remove Linebreaks" in settings.                        |

### Additional Hints
- Add the Labels as Presets in ProPresenter. Add them in the "Labels" section under "Settings" -> "Groups" in ProPresenter. <img src="/readme_res/ProPresenter_label_presets.png?raw=true" width="500" />
- It is possible to change the label of multiple slides at once. To do that, select the slides while holding the "SHIFT" key.
Then click right with the mouse and choose "Label" in the context menu. 
- After changing the label of a slide, you need to click any slide for the changes to apply. 
The Presentation shown in StagePresenter then refreshes after a few seconds.
- It is possible to combine a "normal" label like `Repeat` with a StagePresenter Label. 
Just edit the label and enter e.g. `Repeat $stagepresenter:showOnlyFirstTextBox`.
- It is possible to combine the `$stagepresenter:keepLineBreaks` label with `$stagepresenter:showAllTextBoxes` 
or `$stagepresenter:showOnlyFirstTextBox`. 
Just edit the Label and enter both seperated with a space.


## Chords in the Slide Notes
<p align="center">
<img src="/readme_res/StagePresenter_Chords.png?raw=true" width="700" />
</p>
Chords in the notes of a slide are automatically recognized and displayed in yellow. 

1) Enter the text with the chords into the slide notes. It's best to use the fonts "Helvetica" or "Arial" to align the chords and text. <img src="/readme_res/ProPresenter_slide_notes_chords.png?raw=true" width="700" />
2) Go to StagePresenter Settings and change the setting "Show Slide Notes" selection to "Instead of Slide Content".


## Hide Slides
1) Go to StagePresenter Settings and enable "Do not show disabled Slides".
2) Right click on a slide in ProPresenter and choose "Disable" in the context menu. 

A disabled slide can still be clicked and displayed for the audience. This e.g. useful to hide Media Slides in a Song Presentation.


## Set the Preview Image Background
By default the background of preview images is the gray checkboard template. This can be changed to black e.g. in ProPresenter.
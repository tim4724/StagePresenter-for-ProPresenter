"use strict"

function PresentationDomUpdater() {
    const nextUpElement = document.getElementById('nextUp')
    const presentationContainerElement = document.getElementById('presentationContainer')
    const scroller = Scroller(presentationContainerElement)
    const titleElement = presentationContainerElement.querySelector('#title')
    const slideElements = presentationContainerElement.getElementsByClassName('slide')
    const groupElements = presentationContainerElement.getElementsByClassName('group')
    const previewElement = document.getElementById('preview')
    let slideImagesCache = []
    let scrollTimeout = undefined
    let displayPresentationTimeout = undefined
    let displayPresentationTimeoutEndTime = 0

    if (ResizeObserver) {
        new ResizeObserver(entries => {
           // Wrap in requestAnimationFrame to avoid "ResizeObserver loop limit exceeded"
           requestAnimationFrame(() => {
             if (!Array.isArray(entries) || !entries.length) {
               return;
             }
             onresize()
           });
        }).observe(presentationContainerElement)
    } else {
        window.onresize = onresize
    }
    window.addEventListener('styleChanged', onresize)

    let issueScrollTimeout = undefined
    function onresize() {
        clearTimeout(issueScrollTimeout)
        fixGroupNameElementPosition()
        fixSlidesTextSize()
        issueScrollTimeout = setTimeout(scrollToCurrentSlide, 500)
    }

    function displayPresentation(presentation, slideIndex, animate) {
        nextUpElement.style.display = 'none'
        previewElement.src = 'black16x9.png'
        slideImagesCache = presentation.groups.map(g => g.slides.map(s => s.previewImage)).flat()

        function displayDelayed(duration) {
            return setTimeout(() => {
                display()
                presentationContainerElement.style.opacity = 1
                presentationContainerElement.scrollTop = 0
                clearTimeout(scrollTimeout)
                scrollTimeout = setTimeout(() => {
                    changeCurrentSlideAndScroll(slideIndex, true)
                }, 150)
            }, 300)
        }

        clearTimeout(scrollTimeout)
        clearTimeout(displayPresentationTimeout)
        if (animate) {
            presentationContainerElement.style.opacity = 0
            displayPresentationTimeout = displayDelayed(300)
            displayPresentationTimeoutEndTime = Date.now() + 300
        } else {
            const now = Date.now()
            const dif = displayPresentationTimeoutEndTime - now
            if (dif > 0) {
                displayPresentationTimeout = displayDelayed(dif)
            } else {
                display()
                presentationContainerElement.style.opacity = 1
                presentationContainerElement.scrollTop = 0
                changeCurrentSlideAndScroll(slideIndex, false)
                // Just to be sure, because of a rare bug?
                scrollTimeout = setTimeout(() => {
                    changeCurrentSlideAndScroll(slideIndex, false)
                }, 32)
            }
        }

        function display() {
            while(groupElements.length > 0) {
                groupElements[0].remove()
            }
            const hasText = presentation.groups.some(g => g.slides.some(s => s.lines.length > 0))

            // Update elements
            if (hasText == false) {
                presentationContainerElement.classList.add('noText')
            } else {
                presentationContainerElement.classList.remove('noText')
            }
            titleElement.innerHTML = presentation.name
            titleElement.style.display = presentation.name ? 'block' : 'none'

            // Insert new elements
            for (const group of presentation.groups) {
                const groupElement = buildGroupElement(group)
                presentationContainerElement.append(groupElement)
            }

            fixGroupNameElementPosition()
            fixSlidesTextSize()
        }
    }

    function setNextPresentationTitle(nextTitle) {
        if(nextTitle && nextTitle.length > 0) {
            nextUpElement.innerText = nextTitle
        } else {
            nextUpElement.innerText = ''
            nextUpElement.style.display = 'none'
        }
    }

    function fixGroupNameElementPosition() {
        for (const groupElement of groupElements) {
            const groupNameElement = groupElement.querySelector('.groupName')
            groupNameElement.style.position = 'absolute'

            const firstLine = groupElement.querySelector('.line')
            const groupNameOffsetRight = groupNameElement.offsetLeft + groupNameElement.offsetWidth
            if (firstLine && firstLine.offsetLeft < groupNameOffsetRight) {
                groupNameElement.style.position = ''
            }
        }
    }

    function fixSlidesTextSize() {
        const availableHeight = presentationContainerElement.clientHeight

        const nextUpElementStyleDisplay = nextUpElement.style.display
        nextUpElement.style.display = 'block'
        for (const groupElement of groupElements) {
            const groupNameElement = groupElement.querySelector('.groupName')

            const slideElements = groupElement.querySelectorAll('.slide')
            for (let i = 0; i < slideElements.length; i++) {
                if (slideElements[i].querySelector('.line') == undefined) {
                    continue
                }
                let maxHeight = availableHeight
                if (i === 0) {
                    // TODO: Use real border with instead of hardcoded 6
                    maxHeight -= groupNameElement.scrollHeight + 6
                }
                if (i === slideElements.length - 1) {
                    // TODO: Use real border with instead of hardcoded 6
                    maxHeight -= nextUpElement.scrollHeight + 6
                }

                slideElements[i].style.fontSize = '1em'
                fontSizeReducer(slideElements[i], maxHeight)
            }
        }
        nextUpElement.style.display = nextUpElementStyleDisplay
    }

    function buildGroupElement(group) {
        const groupElement = document.createElement('section')
        groupElement.classList.add('group')
        groupElement.style.borderColor = group.color

        const groupNameElement = document.createElement('div')
        groupNameElement.classList.add('groupName')
        groupNameElement.innerText = group.name
        groupNameElement.style.color = group.color
        groupElement.appendChild(groupNameElement)

        if (group.hasLongTextLines) {
            groupElement.classList.add('groupWithLongText')
        }
        for (const slide of group.slides) {
            const slideElement = document.createElement('div')
            slideElement.classList.add('slide')

            if (slide.isBiblePassage) {
                slideElement.classList.add('biblePassage')
            }
            for (let i = 0; i < slide.lines.length; i++) {
                const line = slide.lines[i]

                const lineSpan = document.createElement('span')
                lineSpan.classList.add('line')

                const bibleVerseNumber = (slide.bibleVerseNumbers || [])[i]
                if (bibleVerseNumber && bibleVerseNumber.length > 0){
                    const bibleVerseSpan = document.createElement('span')
                    bibleVerseSpan.innerText = bibleVerseNumber
                    bibleVerseSpan.classList.add('bibleVerseNumber')
                    lineSpan.appendChild(bibleVerseSpan)
                }

                const textSpan = document.createElement('span')
                textSpan.classList.add('text')
                textSpan.innerText = line.trim()

                lineSpan.appendChild(textSpan)
                slideElement.appendChild(lineSpan)

                if (line.length <= 0) {
                    // Empty line in slide. Ensure that there is a line break.
                    slideElement.appendChild(document.createElement('br'))
                }
            }

            if (slide.lines.length <= 0 && slide.previewImage != undefined
                && slide.previewImage.length > 0) {
                const image = new Image()
                image.src = 'data:image/jpeg;base64,' + slide.previewImage
                slideElement.appendChild(image)
                image.onload = function() {
                    console.log("buildGroupElement Image Height", image.naturalHeight)
                }
                // TODO: Group Color black?
            }
            groupElement.appendChild(slideElement)
        }
        if (group.slides.length <= 0) {
            groupElement.classList.add('emptyGroup')
        }
        if (group.containsBiblePassage) {
            groupElement.classList.add('groupWithBiblePassage')
        }
        return groupElement
    }

    function getCurrentSlideIndex() {
        const currentSlide = presentationContainerElement.querySelector('.currentSlide')
        return Array.prototype.indexOf.call(slideElements, currentSlide)
    }

    function changeCurrentSlideAndScroll(slideIndex, animate = true) {
        if (previewElement.offsetParent !== null) {
            const previewImage = slideImagesCache[slideIndex]
            if (previewImage != undefined && previewImage.length > 0) {
                previewElement.src = 'data:image/jpeg;base64,' + previewImage
            } else {
                previewElement.src = 'black16x9.png'
            }
        } else {
            previewElement.src = 'black16x9.png'
        }

        if (!slideElements || slideElements.length === 0) {
            if (nextUpElement.innerText.length > 0) {
                nextUpElement.style.display = 'inherit'
            }
            return
        }

        const oldSlide = presentationContainerElement.querySelector('.currentSlide')
        const newSlide = slideElements[Math.min(slideIndex, slideElements.length -1)]
        const newGroup = newSlide ? newSlide.parentElement : undefined
        const newSlideGroupIsNotDisplayed = newGroup && newGroup.style.display === 'none'

        if (oldSlide) {
            oldSlide.parentNode.classList.remove('currentGroup')
            if (newSlide && !newSlideGroupIsNotDisplayed) {
                oldSlide.classList.remove('currentSlide')
            } else {
                // Keep class as a hint, what was the last slide
            }
        }

        // Do not scroll to a slide whos group is not visible
        if (newSlide && !newSlideGroupIsNotDisplayed) {
            newSlide.classList.add('currentSlide')
            newSlide.parentElement.classList.add('currentGroup')

            scrollToCurrentSlide(animate)
        }

        const slide = newSlide ? newSlide : oldSlide
        if (nextUpElement.innerText.length > 0 && slide) {
            let isLastGroup = false
            for (let i = groupElements.length - 1; i >= 0; i--) {
                if (groupElements[i] === slide.parentElement) {
                    isLastGroup = true
                    break
                }
                if (!groupElements[i].classList.contains('emptyGroup')) {
                    break
                }
            }
            if (slideElements[slideElements.length - 1] === newSlide) {
                // Last slide
                nextUpElement.style.zIndex = '100'
            } else {
                nextUpElement.style.zIndex = '-2'
            }
            nextUpElement.style.display = isLastGroup ? 'inherit' : 'none'
        } else {
            nextUpElement.style.display = 'none'
        }
    }

    function scrollToCurrentSlide(animate = true) {
        const slideElements = presentationContainerElement.querySelectorAll('.slide')
        const slideCount = slideElements.length
        const slideElement = presentationContainerElement.querySelector('.currentSlide')
        if (!slideElement) {
            return
        }
        const groupElement = slideElement.parentElement

        const availableHeight = presentationContainerElement.clientHeight
        const isFirstSlideInGroup = groupElement.querySelector('.slide') === slideElement
        const isLastSlideOfPresentation = slideElement === slideElements[slideElements.length - 1]
        let scrollDeltaY = undefined

        const groupTop = groupElement.getBoundingClientRect().top
        if (isFirstSlideInGroup || groupElement.scrollHeight < (availableHeight * 0.8)) {
            if (slideElements[0] === slideElement && slideElement.scrollHeight < (availableHeight * 0.5)) {
                scrollDeltaY = titleElement.getBoundingClientRect().top
            } else {
                // Whole group is fits on the screen or this is the first slide
                scrollDeltaY = groupTop
            }
        } else {
            const slideTop = slideElement.getBoundingClientRect().top
            const slideHeight = slideElement.scrollHeight
            if (isLastSlideOfPresentation || slideHeight > (availableHeight * 0.8)) {
                scrollDeltaY = Math.max(slideTop, groupTop)
            } else {
                const remaining = availableHeight - slideHeight
                scrollDeltaY = slideTop - (remaining * (1 / 3))
                scrollDeltaY = Math.max(scrollDeltaY, groupTop)
            }
        }

        if (animate) {
            let isAlreadyVisible = false
            const firstText = slideElement.querySelector('.line .text')
            if (firstText) {
                const top = firstText.getBoundingClientRect().top
                if (top >= 0) {
                    const fontSize = getComputedStyle(firstText).fontSize
                    // Rough estimation of a line height
                    // fontSize * 1.5 should be a little more than a line height
                    const bottom = top + parseInt(fontSize) * 1.5
                    isAlreadyVisible = bottom <= availableHeight
                } else {
                    isAlreadyVisible = false
                }
            } else {
                // Fallback if no text is in the line...
                const { top, bottom } = slideElement.getBoundingClientRect()
                isAlreadyVisible = top >= 0 && bottom <= availableHeight
            }

            if (isAlreadyVisible) {
                // Textline is already visible, scroll slow... :)
                const duration = Math.abs(scrollDeltaY) * 2
                scroller.scroll(0 | scrollDeltaY, Math.max(duration, 300))
            } else {
                // Textline is not visible, scroll fast
                scroller.scroll(0 | scrollDeltaY, 200)
            }
        } else {
            presentationContainerElement.scrollTop += scrollDeltaY
        }
    }

    return {
        displayPresentation: displayPresentation,
        setNextPresentationTitle: setNextPresentationTitle,
        clearNextPresentationTitle: () => setNextPresentationTitle(undefined),
        changeCurrentSlideAndScroll: changeCurrentSlideAndScroll
    }
}

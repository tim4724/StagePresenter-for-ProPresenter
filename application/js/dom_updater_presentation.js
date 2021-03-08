"use strict"

function PresentationDomUpdater() {
    const nextUpElement = document.getElementById('nextUp')
    const presentationContainerElement = document.getElementById('presentationContainer')
    const scroller = Scroller(presentationContainerElement)
    const titleElement = presentationContainerElement.querySelector('#title')
    const slideElements = presentationContainerElement.getElementsByClassName('slide')
    const groupElements = presentationContainerElement.getElementsByClassName('group')

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
        if (animate) {
            presentationContainerElement.style.opacity = 0
            setTimeout(() => {
                display()
                presentationContainerElement.style.opacity = 1
                presentationContainerElement.scrollTop = 0
                setTimeout(() => {
                    changeCurrentSlideAndScroll(slideIndex, true)
                }, 150)
            }, 300)
        } else {
            display()
            presentationContainerElement.scrollTop = 0
            changeCurrentSlideAndScroll(slideIndex, false)
        }

        function display() {
            while(groupElements.length > 0) {
                groupElements[0].remove();
            }

            // Update elements
            titleElement.innerHTML = presentation.name
            titleElement.style.display = presentation.name ? 'block' : 'none'

            // Insert new elements
            for (const group of presentation.groups) {
                const groupElement = buildGroupElement(group)
                presentationContainerElement.append(groupElement)
            }

            if(presentation.groups.length > 0) {
                // Hide the first group if it only contains empty slides
                const firstGroupSlides = presentation.groups[0].slides
                if (!firstGroupSlides || !firstGroupSlides.every(s => s.lines.some(l => l.length > 0))) {
                    groupElements[0].style.display = 'none'
                }
                // TODO: Remove empty groups at the end?
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

            groupElement.appendChild(slideElement)
        }

        if (group.containsBiblePassage) {
            groupElement.classList.add('groupWithBiblePassage')
        }
        if (group.slides.length == 0) {
            // TODO: hide completely? (display none)
            groupElement.classList.add('emptyGroup')
        } else if (group.slides.every(s => s.lines.every(l => l.length === 0))) {
            groupElement.classList.add('emptyGroup')
        }
        return groupElement
    }

    function getCurrentSlideIndex() {
        const currentSlide = presentationContainerElement.querySelector('.currentSlide')
        return Array.prototype.indexOf.call(slideElements, currentSlide)
    }

    function changeCurrentSlideAndScroll(slideIndex, animate = true) {
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

            nextUpElement.style.display = isLastGroup ? 'inherit' : 'none'
        } else {
            nextUpElement.style.display = 'none'
        }
    }

    function scrollToCurrentSlide(animate = true) {
        if (Array.prototype.every.call(groupElements, g => g.classList.contains('emptyGroup'))) {
            // Only empty groups that are not visible, do not scroll
            return
        }
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
            // Whole group is fits on the screen or this is the first slide
            scrollDeltaY = groupTop
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

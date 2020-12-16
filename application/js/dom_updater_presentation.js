"use strict"

const onlyFirstTextInSlide = true
const flexibleSlides = true

function PresentationDomUpdater() {
    let onResizeTimout = undefined
    window.onresize = function () { 
        clearTimeout(onResizeTimout)
        onResizeTimout = setTimeout(function() {
            scrollToCurrentSlide(true)
        }, 500)
    }
    
    const groupTemplate = document.querySelector('.group')
    groupTemplate.parentElement.removeChild(groupTemplate)
    groupTemplate.removeAttribute('id');
    
    const slideTemplate = groupTemplate.querySelector('.slide')
    groupTemplate.removeChild(slideTemplate)
    
    const titleElement = document.getElementById('title')
    const presentationContainerElement = document.getElementById('presentationContainer')
    const bottomSpacer = presentationContainerElement.querySelector('#bottomSpacer')
    
    function displayPresentation(presentation, slideIndex, animate) {
        if (animate) {
            presentationContainer.style.opacity = 0
            setTimeout(function () {
                display()
                presentationContainerElement.scrollTo(0, 0)
                presentationContainer.style.opacity = 1
                changeCurrentSlideAndScroll(slideIndex, true)
            }, 500)
        } else {
            display()
            changeCurrentSlideAndScroll(slideIndex, false)
        }
        
        function display() {            
            // Remove old elements from DOM
            const groupElements = presentationContainerElement.querySelectorAll('.group')
            groupElements.forEach(e => e.parentElement.removeChild(e))
            
            // Update elements
            titleElement.innerHTML = presentation.name
            titleElement.style.display = presentation.name ? 'block' : 'none'
            
            // Insert new elements
            for (const group of presentation.groups) {
                const groupElement = groupTemplate.cloneNode(true)
                groupElement.querySelector('.groupName').innerHTML = group.name
                groupElement.querySelector('.groupName').style.color = group.color
                groupElement.style.borderColor = group.color
                
                for (const slide of group.slides) {
                    const slideElement = slideTemplate.cloneNode(true)
                    if (flexibleSlides) {
                        slideElement.classList.add('flexibleSlide')
                    }
                    const lines = slide.text.split('\n')
                    for (let line of lines) {
                        if (onlyFirstTextInSlide) {
                            line = line.split('\r')[0]
                        } else {
                            line = line.replaceAll('\r', '\n')
                        }
                        const span = document.createElement("span")
                        span.innerText = line.trim()
                        slideElement.appendChild(span)
                    } 
                    groupElement.appendChild(slideElement)
                }
                if (group.slides.length == 0 || group.slides.every(t => t.text.length === 0)) {
                    groupElement.classList.add('emptyGroup')
                }
                presentationContainerElement.insertBefore(groupElement, bottomSpacer)
            }
            
            // Hide the first group if it only contains empty slides
            /// TODO Improve presentation of "Flyer" presentation
            const firstGroupTexts = presentation.groups[0].slides
            if (!firstGroupTexts || firstGroupTexts.every(t => t.text.length === 0)) {
                const firstGroup = presentationContainerElement.querySelector('.group')
                firstGroup.style.display = 'none'
            }
        }
    }
    
    function insertGroupToPresentation(group, index = 0) {
        const groupElement = groupTemplate.cloneNode(true)
        groupElement.querySelector('.groupName').innerHTML = group.name
        groupElement.querySelector('.groupName').style.color = group.color
        groupElement.style.borderColor = group.color

        for (let i = 0; i < group.slides.length; i++) {
            const slideElement = slideTemplate.cloneNode(true)
            slideElement.innerHTML = group.slides[i].text
            groupElement.appendChild(slideElement)
        }
        
        const insertedBeforeCurrent = index <= getCurrentSlideIndex()
        
        const groups = presentationContainerElement.getElementsByClassName('group')
        const elementBefore = index < groups.length ? groups[index] : bottomSpacer
        presentationContainerElement.insertBefore(groupElement, elementBefore)
        
        if (insertedBeforeCurrent) {
            scrollToCurrentSlide(false)
        }
    }
    
    function getCurrentSlideIndex() {
        const slides = presentationContainerElement.getElementsByClassName('slide')
        const currentSlide = presentationContainerElement.querySelector('.currentSlide')
        return Array.prototype.indexOf.call(slides, currentSlide)
    }
    
    function changeCurrentSlideAndScroll(slideIndex, animate = true) {
        const slides = presentationContainerElement.getElementsByClassName('slide')
        if (!slides || slides.length === 0) {
            return
        }
        
        const oldSlide = presentationContainerElement.querySelector('.currentSlide')
        const newSlide = slides[Math.min(slideIndex, slides.length -1)]
        const newSlideIsHidden = newSlide && newSlide.parentElement.style.display === 'none'
        
        if (oldSlide) {
            oldSlide.parentNode.classList.remove('currentGroup')
            if (newSlide && !newSlideIsHidden) {
                oldSlide.classList.remove('currentSlide')
            } else {
                // Keep class as a hint, what was the last slide
            }
        }
        
        // Do not scroll to a slide whos group is not visible
        if (newSlide && !newSlideIsHidden) {
            newSlide.classList.add('currentSlide')
            newSlide.parentElement.classList.add('currentGroup')
            scrollToCurrentSlide(animate)
            
            // Yes sometimes it just does not scroll...
            // Try again
            setTimeout(function () {
                scrollToCurrentSlide(animate)
            }, 32)
        }
    }
    
    function scrollToCurrentSlide(animate = true) {
        const slide = presentationContainerElement.querySelector('.currentSlide')
        if (!slide) {
            return
        }
        
        const presentationContainerHeight = presentationContainerElement.clientHeight
        const isFirstSlideInGroup = slide.parentElement.querySelector('.slide') === slide
        
        let deltaY
        if (isFirstSlideInGroup || slide.parentElement.scrollHeight < (presentationContainerHeight * 0.9)) {
            // Just a small offfset to make it look good
            const smallOffset = parseFloat(getComputedStyle(document.body).fontSize) * 0.5
            // Whole group is fits in screen or this is the first slide
            deltaY = slide.parentElement.getBoundingClientRect().top - smallOffset
        } else {
            deltaY = slide.getBoundingClientRect().top - presentationContainerHeight * 0.2
        }
        
        // TODO: Scroll faster if new slide is not visible...
        
        deltaY = (0 | deltaY) // Cast y to int
        if (deltaY !== 0) {
            const top = deltaY + presentationContainerElement.scrollTop
            presentationContainerElement.scrollTo({top: top, behavior: animate ? 'smooth' : 'auto'})
        }
    }
    
    return {
        displayPresentation: displayPresentation,
        insertGroupToPresentation: insertGroupToPresentation,
        changeCurrentSlideAndScroll: changeCurrentSlideAndScroll
    }
}

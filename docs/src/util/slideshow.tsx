import React, { useEffect, useState } from 'react'

const slides = [
	{
		name: 'Default',
		src: '/img/index.png',
		alt: 'MarkFlowy',
	},
	{
		name: 'Dark Mode',
		src: '/img/darkmode.png',
		alt: 'MarkFlowy Dark Mode',
	},
	{
		name: 'Chatgpt',
		src: '/img/chatgpt.png',
		alt: 'MarkFlowy Chatgpt Extension',
	},
]

const SLIDE_INTERVAL = 2500

export default function Slideshow() {
	const [index, setIndex] = useState(0)
	const [handle, setHandle] = useState<NodeJS.Timeout | undefined>()

	const destroyIntervalTimer = () => {
		clearInterval(handle)
		setHandle(undefined)
	}

	const createIntervalTimer = () => {
		destroyIntervalTimer()
		setHandle(setInterval(() => setIndex((i) => (i + 1) % slides.length), SLIDE_INTERVAL))
	}

	const handleSlideSelect = (idx) => {
		createIntervalTimer()
		setIndex(idx)
	}

	useEffect(() => {
		createIntervalTimer()
		return destroyIntervalTimer
	}, [])

	return (
		<>
			<div className="slideshow-container">
				{slides.map((e, i) => (
					<div key={i} className={`slide${index === i ? ' active' : ''}`}>
						<div className="slide-numbertext">
							{i + 1} / {slides.length}
						</div>

						<img src={e.src} alt={e.alt} />
						<p className="slide-caption">{e.name}</p>
					</div>
				))}
			</div>

			<div className="slide-dots">
				{slides.map((e, i) => (
					<span onClick={() => handleSlideSelect(i)} key={e.name} className={`slide-dot${i === index ? ' active' : ''}`} />
				))}
			</div>
		</>
	)
}

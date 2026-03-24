import React, { useEffect, useMemo, useState } from 'react';

interface CarouselProps {
  children: React.ReactNode;
}

const Carousel: React.FC<CarouselProps> = ({ children }) => {
  const slides = useMemo(() => React.Children.toArray(children), [children]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const totalSlides = slides.length;

  useEffect(() => {
    if (totalSlides <= 1 || isPaused) return undefined;

    const timer = window.setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % totalSlides);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [isPaused, totalSlides]);

  const showPrev = () => {
    setCurrentIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  const showNext = () => {
    setCurrentIndex((prev) => (prev + 1) % totalSlides);
  };

  return (
    <div
      className="carousel-container"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div
        className="carousel"
        style={{ transform: `translateX(-${currentIndex * 100}%)` }}
      >
        {slides}
      </div>

      {totalSlides > 1 ? (
        <div className="carousel-controls">
          <button type="button" className="carousel-control" onClick={showPrev} aria-label="Предыдущий слайд">
            ←
          </button>
          <button type="button" className="carousel-control" onClick={showNext} aria-label="Следующий слайд">
            →
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default Carousel;

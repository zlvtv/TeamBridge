import React from 'react';

interface SlideProps {
  eyebrow: string;
  title: string;
  description: string;
  highlights: string[];
  accent: string;
  visualCards: {
    label: string;
    title: string;
    description?: string;
    size?: 'large' | 'default';
  }[];
}

const Slide: React.FC<SlideProps> = ({
  eyebrow,
  title,
  description,
  highlights,
  accent,
  visualCards,
}) => {
  return (
    <div className="carousel-slide">
      <div className="slide-copy">
        <span className="slide-eyebrow">{eyebrow}</span>
        <h3>{title}</h3>
        <p>{description}</p>

        <div className="slide-highlights">
          {highlights.map((item) => (
            <div key={item} className="slide-highlight">
              <span className="slide-highlight-dot" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="slide-visual" aria-hidden="true">
        <div className="slide-accent">{accent}</div>
        <div className="slide-visual-grid">
          {visualCards.map((card) => (
            <div
              key={`${card.label}-${card.title}`}
              className={`slide-visual-card ${card.size === 'large' ? 'slide-visual-card--large' : ''}`.trim()}
            >
              <span>{card.label}</span>
              <strong>{card.title}</strong>
              {card.description ? <p>{card.description}</p> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Slide;

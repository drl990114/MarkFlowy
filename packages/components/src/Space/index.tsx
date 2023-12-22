import React from 'react'

interface SpaceProps extends BaseComponentProps {
  size?: number
}

const Space: React.FC<SpaceProps> = ({ children, size = 6, ...rest }) => {
  if (React.Children.count(children) <= 1) return children

  const firstChildStyle = {
    display: 'inline-block',
  }

  const otherChildStyle = {
    display: 'inline-block',
    marginLeft: `${size}px`,
  }

  return (
    <span {...rest}>
      {React.Children.map(children, (child, index) => (
        <span key={index} style={index === 0 ? firstChildStyle : otherChildStyle}>
          {child}
        </span>
      ))}
    </span>
  )
}

export default Space

'use client';

export function Card({ children, className = '', padding = true, hover = false, ...props }) {
  return (
    <div className={`card ${hover ? 'card-hover' : ''} ${className}`.trim()} style={padding ? undefined : { padding: 0 }} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', ...props }) {
  return <div className={`card-header ${className}`.trim()} {...props}>{children}</div>;
}

export function CardBody({ children, className = '', ...props }) {
  return <div className={`card-body ${className}`.trim()} {...props}>{children}</div>;
}

export function CardFooter({ children, className = '', ...props }) {
  return <div className={`card-footer ${className}`.trim()} {...props}>{children}</div>;
}

export default Card;

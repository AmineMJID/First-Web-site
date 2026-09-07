'use client';

export function Skeleton({ className = '', width, height, variant = 'text', ...props }) {
  const style = {};
  if (width) style.width = width;
  if (height) style.height = height;
  
  return (
    <div 
      className={`skeleton skeleton-${variant} ${className}`.trim()} 
      style={style}
      {...props}
    />
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="card table-container">
      <table>
        <thead>
          <tr>
            {Array.from({ length: cols }).map((_, i) => (
              <th key={i}><Skeleton width="80px" /></th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <tr key={rowIdx}>
              {Array.from({ length: cols }).map((_, colIdx) => (
                <td key={colIdx}><Skeleton width={`${60 + Math.random() * 40}%`} /></td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <Skeleton variant="circular" width="48px" height="48px" />
        <div style={{ flex: 1 }}>
          <Skeleton width="60%" height="20px" style={{ marginBottom: '8px' }} />
          <Skeleton width="40%" height="16px" />
        </div>
      </div>
      <Skeleton width="100%" height="100px" />
    </div>
  );
}

export function SkeletonStats() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card" style={{ padding: '20px' }}>
          <Skeleton width="50%" height="16px" style={{ marginBottom: '12px' }} />
          <Skeleton width="30%" height="32px" style={{ marginBottom: '16px' }} />
          <Skeleton width="100%" height="4px" />
        </div>
      ))}
    </div>
  );
}

export default Skeleton;

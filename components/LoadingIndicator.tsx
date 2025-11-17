
import React from 'react';

interface LoadingIndicatorProps {
  message: string;
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ message }) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center my-8">
      <div className="relative w-20 h-20">
        <svg className="w-full h-full" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <circle cx="50" cy="50" r="45" stroke="rgba(192, 132, 252, 0.2)" strokeWidth="4" fill="none" />
          <path
            fill="none"
            stroke="url(#spinner-gradient)"
            strokeWidth="4"
            strokeLinecap="round"
            d="M50,5 A45,45 0 0,1 95,50"
            className="animate-spin"
            style={{ transformOrigin: '50% 50%' }}
          />
          <defs>
            <linearGradient id="spinner-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="rgba(233, 171, 255, 1)" />
              <stop offset="100%" stopColor="rgba(168, 85, 247, 0)" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-purple-300">
           ✨
        </div>
      </div>
      <p className="mt-4 text-lg text-gray-300">{message}</p>
    </div>
  );
};

export default LoadingIndicator;
import React from 'react';

const Video = ({ src }) => {
  return (
    <video autoPlay loop muted className="w-full h-full object-cover">
      <source src='http://bishnu.info.np/wp-content/uploads/2024/02/production_id_4069480-2160p-1.mp4' type="video/mp4" />
      Your browser does not support the video tag.
    </video>
  );
};

export default Video;

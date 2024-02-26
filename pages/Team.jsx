import React from 'react';

const TeamPage = () => {
  const teamMembers = [
    {
      name: 'B D',
      role: 'CEO and Founder',
      image: '/assets/i4.jpg',
      description: 'Our CEO and Founder of Hospitality NFT, has been leading with vision and passion, steering our project towards new horizons in the realm of blockchain-based hotel booking systems. Their visionary leadership has guided the team through challenges and opportunities, setting the stage for transformative advancements in the hospitality industry.',
    },
    {
      name: 'Andre',
      role: 'Project Manager and Supervisor',
      image: '/assets/i5.jpg',
      description: 'Our Project Manager/Coordinator has been instrumental in guiding our project progress and refining our website functionality. With keen oversight and a deep understanding of the objectives of our project.',
    },
    {
      name: 'Kabita Gautam',
      role: 'FullStack Developer',
      image: '/assets/i1.jpg',
      description: 'Our fullstack developers are the architects of user experience, weaving together code and creativity to craft intuitive interfaces that captivate and engage also building the foundation of our systems with robust code and innovative solutions, ensuring seamless functionality behind the scenes.',
    },
    {
      name: 'Bishnu Thapa',
      role: 'Blockchain Developer',
      image: '/assets/i2.jpg',
      description: 'Our blockchain developer has been making remarkable strides in advancing our project blockchain capabilities. From deploying smart contracts tailored to our needs to seamlessly integrating our blockchain with external systems, their dedication has been instrumental. '
    },
    {
      name: 'Rakshya Shrestha',
      role: 'Graphic Designer',
      image: '/assets/i3.jpg',
      description: 'Our graphics designers are the visual storytellers, transforming ideas into stunning visuals that breathe life into our projects, creating memorable experiences for our users.',
    },
   
  ];

  return (
    <div className="bg-gray-100 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            Meet the Team
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Get to know the talented individuals behind our company.
          </p>
        </div>
        <div className="mt-10 max-w-4xl mx-auto grid grid-cols-1 gap-6 lg:grid-cols-3 lg:max-w-none">
          {teamMembers.map((member, index) => (
            <div
              key={index}
              className="rounded-lg shadow-lg overflow-hidden"
            >
              <img
                className="w-full h-64 object-cover"
                src={member.image}
                alt={member.name}
              />
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900">
                  {member.name}
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  {member.role}
                </p>
                <p className="mt-4 text-gray-700">
                  {member.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TeamPage;

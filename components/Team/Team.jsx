import React from 'react';

function TeamPage() {
  const teamMembers = [
    {
      name: '',
      role: '',
      image: '/assets/i1.jpg',
      description: '',
    },
    {
      name: '',
      role: '',
      image: '/assets/i1.jpg',
      description: '',
    },
    {
      name: 'Kabita Gautam',
      role: 'Frontend Developer',
      image: '/assets/i1.jpg',
      description: 'Our frontend developers are the architects of user experience, weaving together code and creativity to craft intuitive interfaces that captivate and engage.',
    },
    {
        name: 'Bishnu Thapa',
        role: 'Backend Developer',
        image: '/assets/i1.jpg',
        description: 'Our backend developers are the unseen heroes, building the foundation of our systems with robust code and innovative solutions, ensuring seamless functionality behind the scenes.',
      },
      {
        name: 'Rakshya Shrestha',
        role: 'Graphis Designer',
        image: '/assets/i1.jpg',
        description: 'Our graphics designers are the visual storytellers, transforming ideas into stunning visuals that breathe life into our projects, creating memorable experiences for our users.',
      },
    // ... more team members
  ];

  return (
    <div className="container mx-auto px-4">
      <h1 className="text-3xl font-bold mb-8">Meet the Team</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {teamMembers.map((member) => (
          <div key={member.name} className="bg-white rounded-lg shadow-md p-4">
            <img src={member.image} alt={member.name} className="w-full h-64 object-cover rounded-t-lg" />
            <div className="p-4">
              <h2 className="text-lg font-semibold mb-2">{member.name}</h2>
              <p className="text-gray-600">{member.role}</p>
              <p className="text-gray-700 mt-2">{member.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default TeamPage;

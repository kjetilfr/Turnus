export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              Nurse Scheduling App
            </h1>
            <p className="text-xl text-gray-600">
              Simplify your healthcare staff scheduling
            </p>
          </div>

          {/* Feature Cards */}
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="text-3xl mb-4">📅</div>
              <h3 className="text-xl font-semibold mb-2">Easy Scheduling</h3>
              <p className="text-gray-600">
                Create and manage nurse schedules with an intuitive interface
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="text-3xl mb-4">👥</div>
              <h3 className="text-xl font-semibold mb-2">Staff Management</h3>
              <p className="text-gray-600">
                Track nurse availability, skills, and preferences
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
              <div className="text-3xl mb-4">📊</div>
              <h3 className="text-xl font-semibold mb-2">Shift Analytics</h3>
              <p className="text-gray-600">
                Monitor coverage, overtime, and staffing patterns
              </p>
            </div>
          </div>

          {/* CTA Section */}
          <div className="bg-white rounded-lg shadow-xl p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
            <p className="text-gray-600 mb-6">
              This is your test deployment. Database connection coming next!
            </p>
            <button className="bg-indigo-600 text-white px-8 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-colors">
              Coming Soon: Login
            </button>
          </div>

          {/* Status Badge */}
          <div className="mt-8 text-center">
            <span className="inline-flex items-center px-4 py-2 rounded-full bg-green-100 text-green-800 text-sm font-medium">
              ✓ Next.js + React + Tailwind Setup Complete
            </span>
          </div>
        </div>
      </div>
    </main>
  );
}
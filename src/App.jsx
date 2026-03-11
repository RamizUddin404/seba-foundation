import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import './App.css';

// ---------------------- CONFIGURATION ----------------------
const SUPABASE_URL = "https://xpylwvyjhxomxhqhacxa.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhweWx3dnlqaHhvbXhocWhhY3hhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNDY2NjQsImV4cCI6MjA4ODcyMjY2NH0.oSAwXxDzarxbl8C2THyOxUm-4q_2aPsCq1rzLsXt8Lw";
const OPENROUTER_API_KEY = "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";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------------- HELPERS ----------------------
const isEligibleToDonate = (lastDate) => {
  if (!lastDate) return true; // Never donated
  const donationDate = new Date(lastDate);
  const today = new Date();
  const diffTime = Math.abs(today - donationDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 90; // 3 months = 90 days
};

const formatDate = (dateString) => {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  return date.toLocaleDateString('bn-BD', { year: 'numeric', month: 'long', day: 'numeric' });
};

// ---------------------- AI CHAT COMPONENT ----------------------
const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: 'system', content: 'You are Seba AI, a helpful assistant for a blood donation app. Answer in Bengali or English.' }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatRef = useRef(null);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const newMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, newMsg]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          "model": "google/gemini-2.0-flash-lite-preview-02-05:free",
          "messages": [...messages, newMsg]
        })
      });
      const data = await response.json();
      if(data.choices && data.choices[0]) {
         setMessages(prev => [...prev, data.choices[0].message]);
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'দুঃখিত, আমি এখন উত্তর দিতে পারছি না। একটু পরে আবার চেষ্টা করুন।' }]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  return (
    <div className="chat-widget">
      {!isOpen && (
        <button className="chat-toggle btn-3d" onClick={() => setIsOpen(true)}>
          🤖 <span>হেল্প চ্যাট</span>
        </button>
      )}
      {isOpen && (
        <div className="chat-box glass animate-pop">
          <div className="chat-header">
            <h3>SEBA AI Assistant</h3>
            <button onClick={() => setIsOpen(false)}>✕</button>
          </div>
          <div className="chat-body" ref={chatRef}>
            {messages.filter(m => m.role !== 'system').map((m, i) => (
              <div key={i} className={`chat-msg ${m.role}`}>
                {m.content}
              </div>
            ))}
            {loading && <div className="spinner-sm"></div>}
          </div>
          <div className="chat-input">
            <input 
              value={input} 
              onChange={e => setInput(e.target.value)} 
              onKeyPress={e => e.key === 'Enter' && sendMessage()}
              placeholder="কিভাবে সাহায্য করতে পারি?..." 
            />
            <button onClick={sendMessage}>➤</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------- MAIN APP ----------------------
function App() {
  const [session, setSession] = useState(null);
  const [requests, setRequests] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBG, setFilterBG] = useState('All');
  const [loading, setLoading] = useState(false);

  // Default blood groups
  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  // Data Sync
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    fetchPublicData();

    // Real-time updates
    const sub1 = supabase.channel('public:requests').on('postgres_changes', { event: '*', schema: 'public', table: 'blood_requests' }, fetchPublicData).subscribe();
    const sub2 = supabase.channel('public:profiles').on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchPublicData).subscribe();

    return () => { supabase.removeChannel(sub1); supabase.removeChannel(sub2); };
  }, []);

  const fetchPublicData = async () => {
    const { data: reqs } = await supabase.from('blood_requests').select('*').order('created_at', { ascending: false });
    if (reqs) setRequests(reqs);
    const { data: pros } = await supabase.from('profiles').select('*').order('last_donation_date', { ascending: true });
    if (pros) setProfiles(pros);
  };

  // Join Logic (Creates an account behind the scenes)
  const handleJoin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.target);
    const email = fd.get('email');
    const password = fd.get('password');
    const fullName = fd.get('name');
    const bloodGroup = fd.get('bgroup');
    
    // Check if user exists or sign up
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName, blood_group: bloodGroup } }
    });

    if (error) alert(error.message);
    else {
      alert('সফলভাবে যুক্ত হয়েছেন! এখন আপনি প্রোফাইল এডিট করতে পারবেন।');
      setShowJoinModal(false);
      window.location.reload();
    }
    setLoading(false);
  };

  const postRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.target);
    const { error } = await supabase.from('blood_requests').insert([{
      patient_name: fd.get('pname'),
      blood_group: fd.get('bgroup'),
      location: fd.get('loc'),
      phone: fd.get('phone'),
      posted_by: 'Public User',
      status: 'pending'
    }]);
    
    if (error) alert('Error: ' + error.message);
    else { alert('আবেদন সফলভাবে পোস্ট করা হয়েছে! ✅'); setActiveTab('live'); }
    setLoading(false);
  };

  return (
    <div className="app-main">
      {/* 3D Background Elements */}
      <div className="orb orb-1"></div>
      <div className="orb orb-2"></div>

      {/* Sidebar / Nav */}
      <aside className="sidebar glass hide-mobile">
        <div className="logo-area" onClick={() => setActiveTab('home')}>
          <div className="logo-icon 3d-icon">🩸</div>
          <h2>SEBA</h2>
        </div>
        <nav className="side-nav">
          <li className={activeTab === 'home' ? 'active' : ''} onClick={() => setActiveTab('home')}>🏠 ড্যাশবোর্ড</li>
          <li className={activeTab === 'donors' ? 'active' : ''} onClick={() => setActiveTab('donors')}>👥 ডোনার লিস্ট</li>
          <li className={activeTab === 'live' ? 'active' : ''} onClick={() => setActiveTab('live')}>❤️ লাইভ ফিড</li>
          <li className={activeTab === 'request' ? 'active' : ''} onClick={() => setActiveTab('request')}>📝 রক্ত চাই</li>
          {session ? (
            <li onClick={() => setActiveTab('profile')}>👤 আমার প্রোফাইল</li>
          ) : (
            <li className="highlight-btn" onClick={() => setShowJoinModal(true)}>✨ ডোনার হোন</li>
          )}
        </nav>
      </aside>

      <main className="content-container">
        <header className="mobile-header show-mobile glass">
          <div className="logo-icon">🩸</div><h2>SEBA</h2>
          {!session && <button className="btn-sm-join" onClick={() => setShowJoinModal(true)}>Join</button>}
        </header>

        {/* HOME VIEW */}
        {activeTab === 'home' && (
          <div className="home-view animate-fade">
            <div className="hero-pro glass 3d-card">
              <h1>রক্ত দিন, জীবন বাঁচান ❤️</h1>
              <p>বাংলাদেশের সবচেয়ে আধুনিক ব্লাড ডোনেশন নেটওয়ার্ক</p>
              <div className="pro-stats">
                <div className="stat-item"><h3>{requests.filter(r => r.status === 'pending').length}</h3><p>জরুরী প্রয়োজন</p></div>
                <div className="stat-item"><h3>{profiles.filter(p => isEligibleToDonate(p.last_donation_date)).length}</h3><p>রেডি ডোনার</p></div>
                <div className="stat-item"><h3>{profiles.length}</h3><p>মোট সদস্য</p></div>
              </div>
            </div>
            
            <div className="action-grid">
               <button className="btn-3d btn-primary" onClick={() => setActiveTab('request')}>
                 <span style={{fontSize:'1.5rem'}}>🩸</span> জরুরী রক্ত প্রয়োজন
               </button>
               <button className="btn-3d btn-secondary" onClick={() => setActiveTab('donors')}>
                 <span style={{fontSize:'1.5rem'}}>🔍</span> ডোনার খুঁজুন
               </button>
            </div>
          </div>
        )}

        {/* DONOR LIST VIEW (Public) */}
        {activeTab === 'donors' && (
          <div className="donor-view animate-fade">
            <h2 className="section-title">রক্তদাতার তালিকা 🩸</h2>
            <div className="filter-area glass">
              <input placeholder="এলাকা বা নাম দিয়ে খুঁজুন..." onChange={(e) => setSearchQuery(e.target.value.toLowerCase())} />
              <select onChange={(e) => setFilterBG(e.target.value)}>
                <option value="All">সব গ্রুপ</option>
                {bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}
              </select>
            </div>
            
            <div className="pro-grid">
              {profiles
                .filter(p => (filterBG === 'All' || p.blood_group === filterBG) && (p.full_name?.toLowerCase().includes(searchQuery) || p.location?.toLowerCase().includes(searchQuery)))
                .map(p => {
                  const eligible = isEligibleToDonate(p.last_donation_date);
                  return (
                    <div key={p.id} className={`pro-donor-card glass 3d-card ${eligible ? 'available' : 'unavailable'}`}>
                      <div className="donor-header">
                         <img src={p.avatar_url || `https://ui-avatars.com/api/?name=${p.full_name}&background=random`} className="donor-avatar" />
                         <div className="donor-blood-tag">{p.blood_group}</div>
                      </div>
                      <h3>{p.full_name}</h3>
                      <p>📍 {p.location || 'Unknown'}</p>
                      
                      <div className="donation-status">
                        {eligible ? (
                          <span className="badge-success">✅ Available</span>
                        ) : (
                          <span className="badge-warning">⏳ {formatDate(p.last_donation_date)} এ দিয়েছেন</span>
                        )}
                      </div>
                      
                      {eligible && <button className="btn-call" onClick={() => window.open(`tel:${p.phone}`)}>📞 কল করুন</button>}
                    </div>
                  );
              })}
            </div>
          </div>
        )}

        {/* REQUEST BLOOD (Public) */}
        {activeTab === 'request' && (
          <div className="request-view animate-fade">
             <div className="glass form-container 3d-card">
              <h2 style={{textAlign:'center', marginBottom:'1.5rem'}}>রক্তের আবেদন করুন 📝</h2>
              <form onSubmit={postRequest}>
                <input name="pname" placeholder="রোগীর নাম" required />
                <div className="row-2">
                  <select name="bgroup" required><option value="">গ্রুপ নির্বাচন করুন</option>{bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}</select>
                  <input name="phone" placeholder="ফোন নম্বর" required />
                </div>
                <input name="loc" placeholder="হাসপাতাল ও ঠিকানা" required />
                <button type="submit" className="btn-3d btn-primary" disabled={loading}>
                  {loading ? 'পোস্ট হচ্ছে...' : 'আবেদন সাবমিট করুন'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* LIVE FEED (Public) */}
        {activeTab === 'live' && (
          <div className="feed-view animate-fade">
            <h2 className="section-title">লাইভ ব্লাড ফিড ❤️</h2>
            <div className="pro-grid">
              {requests.map(req => (
                <div key={req.id} className="pro-req-card glass 3d-card">
                  <div className="req-header"><div className="blood-badge">{req.blood_group}</div><small>{new Date(req.created_at).toLocaleDateString()}</small></div>
                  <h3>{req.patient_name}</h3>
                  <p>📍 {req.location}</p>
                  <div className="req-actions">
                    <button className="btn-call" onClick={() => window.open(`tel:${req.phone}`)}>📞 কল করুন</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* JOIN MODAL */}
      {showJoinModal && (
        <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="pro-modal glass animate-pop" onClick={e => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setShowJoinModal(false)}>✕</button>
            <h2>ডোনার হিসেবে যুক্ত হোন ✨</h2>
            <p style={{marginBottom:'1.5rem', color:'#94a3b8'}}>আপনার রক্তে বাঁচবে একটি প্রাণ</p>
            <form onSubmit={handleJoin}>
              <input name="name" placeholder="আপনার নাম" required />
              <div className="row-2">
                <select name="bgroup" required><option value="">রক্তের গ্রুপ</option>{bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}</select>
                <input name="email" type="email" placeholder="ইমেইল (লগইন এর জন্য)" required />
              </div>
              <input name="password" type="password" placeholder="পাসওয়ার্ড (পরে এডিট করতে লাগবে)" required minLength={6} />
              <button type="submit" className="btn-3d btn-primary" disabled={loading}>
                {loading ? 'যুক্ত করা হচ্ছে...' : 'যুক্ত হোন'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* AI CHATBOT */}
      <ChatBot />

      {/* MOBILE NAV */}
      <nav className="bottom-nav show-mobile glass">
        <li className={activeTab === 'home' ? 'active' : ''} onClick={() => setActiveTab('home')}>🏠</li>
        <li className={activeTab === 'donors' ? 'active' : ''} onClick={() => setActiveTab('donors')}>👥</li>
        <li className={activeTab === 'request' ? 'active' : ''} onClick={() => setActiveTab('request')}>➕</li>
        <li className={activeTab === 'live' ? 'active' : ''} onClick={() => setActiveTab('live')}>❤️</li>
      </nav>
    </div>
  );
}

export default App;

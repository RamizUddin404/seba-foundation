import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import './App.css';

// ---------------------- CONFIG ----------------------
const SUPABASE_URL = "https://xpylwvyjhxomxhqhacxa.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhweWx3dnlqaHhvbXhocWhhY3hhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNDY2NjQsImV4cCI6MjA4ODcyMjY2NH0.oSAwXxDzarxbl8C2THyOxUm-4q_2aPsCq1rzLsXt8Lw";
const OPENROUTER_API_KEY = "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";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------------------- HELPERS ----------------------
const checkEligibility = (lastDate) => {
  if (!lastDate) return { isEligible: true, status: 'Available', daysLeft: 0 };
  const last = new Date(lastDate);
  const now = new Date();
  const diffDays = Math.ceil((now - last) / (1000 * 60 * 60 * 24));
  return {
    isEligible: diffDays > 90,
    daysLeft: 90 - diffDays,
    status: diffDays > 90 ? 'Available' : 'Already Donated'
  };
};

const formatDate = (d) => d ? new Date(d).toLocaleDateString('bn-BD', { day: 'numeric', month: 'long', year: 'numeric' }) : 'কখনো না';

// ---------------------- AI CHATBOT ----------------------
const ChatBot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([{ role: 'assistant', content: 'আসসালামু আলাইকুম! আমি সেবা এআই। আমি আপনাকে রক্তদান সংক্রান্ত তথ্য দিয়ে সাহায্য করতে পারি।' }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatRef = useRef(null);

  const askAI = async () => {
    if (!input.trim()) return;
    const userMsg = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-lite-preview-02-05:free",
          messages: [...messages, userMsg]
        })
      });
      const data = await res.json();
      setMessages(prev => [...prev, data.choices[0].message]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'দুঃখিত, এখন উত্তর দিতে পারছি না।' }]);
    }
    setLoading(false);
  };

  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight; }, [messages]);

  return (
    <div className="chat-widget">
      {!isOpen && <button className="chat-btn btn-3d" onClick={() => setIsOpen(true)}>🤖 হেল্প চ্যাট</button>}
      {isOpen && (
        <div className="chat-box glass animate-pop">
          <div className="chat-head"><h3>Seba AI</h3><button onClick={() => setIsOpen(false)}>✕</button></div>
          <div className="chat-body" ref={chatRef}>
            {messages.map((m, i) => <div key={i} className={`msg ${m.role}`}>{m.content}</div>)}
            {loading && <div className="spinner-sm"></div>}
          </div>
          <div className="chat-foot">
            <input value={input} onChange={e => setInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && askAI()} placeholder="কিছু জিজ্ঞাসা করুন..." />
            <button onClick={askAI}>➤</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------- MAIN APP ----------------------
function App() {
  const [donors, setDonors] = useState([]);
  const [activeTab, setActiveTab] = useState('home');
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState('All');
  const [loading, setLoading] = useState(false);

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  useEffect(() => {
    fetchDonors();
    const sub = supabase.channel('donors-sync').on('postgres_changes', { event: '*', schema: 'public', table: 'donors' }, fetchDonors).subscribe();
    return () => supabase.removeChannel(sub);
  }, []);

  const fetchDonors = async () => {
    const { data } = await supabase.from('donors').select('*').order('last_donation_date', { ascending: false });
    if (data) setDonors(data);
  };

  const registerDonor = async (e) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.target);
    const { error } = await supabase.from('donors').upsert({
      full_name: fd.get('name'),
      blood_group: fd.get('bgroup'),
      phone: fd.get('phone'),
      location: fd.get('loc'),
      last_donation_date: fd.get('ldate') || null
    }, { onConflict: 'phone' });

    if (error) alert('Error: ' + error.message);
    else {
      alert('তথ্য সফলভাবে সংরক্ষিত হয়েছে! ✨');
      setActiveTab('list');
    }
    setLoading(false);
  };

  return (
    <div className="app-main">
      <div className="orb orb-1"></div><div className="orb orb-2"></div>

      <aside className="sidebar glass hide-mobile">
        <div className="logo-area" onClick={() => setActiveTab('home')}><div className="logo-icon 3d-icon">🩸</div><h2>SEBA</h2></div>
        <nav className="side-nav">
          <li className={activeTab === 'home' ? 'active' : ''} onClick={() => setActiveTab('home')}>🏠 ড্যাশবোর্ড</li>
          <li className={activeTab === 'list' ? 'active' : ''} onClick={() => setActiveTab('list')}>🔍 ডোনার খুঁজুন</li>
          <li className={activeTab === 'add' ? 'active' : ''} onClick={() => setActiveTab('add')}>➕ ডোনার ইনফো</li>
        </nav>
      </aside>

      <main className="content-container">
        <header className="mobile-header show-mobile glass">
          <div className="logo-icon 3d-icon">🩸</div><h2>SEBA</h2>
        </header>

        {activeTab === 'home' && (
          <div className="home-view animate-fade">
            <div className="hero glass 3d-card">
              <h1>মানবতার ডিজিটাল সেবা ❤️</h1>
              <p>রক্ত দিন, জীবন বাঁচান। বাংলাদেশের সবচেয়ে সহজ রক্তদাতা নেটওয়ার্ক।</p>
              <div className="stats-row">
                <div className="stat-card glass"><h3>{donors.length}</h3><p>মোট ডোনার</p></div>
                <div className="stat-card glass"><h3>{donors.filter(d => checkEligibility(d.last_donation_date).isEligible).length}</h3><p>অ্যাভেইলেবল</p></div>
              </div>
            </div>
            <div className="action-grid">
              <button className="btn-3d btn-primary" onClick={() => setActiveTab('list')}>🔍 রক্তদাতা খুঁজুন</button>
              <button className="btn-3d btn-sub" onClick={() => setActiveTab('add')}>🩸 তথ্য যোগ করুন</button>
            </div>
          </div>
        )}

        {activeTab === 'list' && (
          <div className="list-view animate-fade">
            <h2 className="title">ডোনার লিস্ট 🩸</h2>
            <div className="filter-box glass">
              <input placeholder="শহর বা নাম দিয়ে খুঁজুন..." onChange={e => setSearch(e.target.value.toLowerCase())} />
              <select onChange={e => setGroup(e.target.value)}>
                <option value="All">সব গ্রুপ</option>
                {bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}
              </select>
            </div>

            <div className="grid">
              {donors
                .filter(d => (group === 'All' || d.blood_group === group) && (d.full_name.toLowerCase().includes(search) || d.location.toLowerCase().includes(search)))
                .map(d => {
                  const el = checkEligibility(d.last_donation_date);
                  return (
                    <div key={d.id} className={`card glass 3d-card ${!el.isEligible ? 'busy' : ''}`}>
                      <div className="blood-icon">{d.blood_group}</div>
                      <h3>{d.full_name}</h3>
                      <p>📍 {d.location}</p>
                      <div className="status-badge">
                        {el.isEligible ? 
                          <span className="available">✅ Available</span> : 
                          <span className="already">⏳ Donated ({formatDate(d.last_donation_date)})</span>
                        }
                      </div>
                      {el.isEligible ? (
                        <button className="btn-call" onClick={() => window.open(`tel:${d.phone}`)}>📞 কল দিন</button>
                      ) : (
                        <p className="wait-msg">{el.daysLeft} দিন পর দিতে পারবেন</p>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {activeTab === 'add' && (
          <div className="add-view animate-fade">
            <div className="form-card glass 3d-card">
              <h2>আপনার তথ্য দিন ✨</h2>
              <p>আপনার ফোন নম্বর দিয়ে তথ্য আপডেট করতে পারবেন।</p>
              <form onSubmit={registerDonor}>
                <input name="name" placeholder="আপনার পুরো নাম" required />
                <div className="row">
                  <select name="bgroup" required><option value="">রক্তের গ্রুপ</option>{bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}</select>
                  <input name="phone" placeholder="মোবাইল নম্বর (ইউনিক)" required />
                </div>
                <input name="loc" placeholder="হাসপাতাল বা শহরের নাম" required />
                <label>সর্বশেষ রক্তদানের তারিখ (না দিয়ে থাকলে ফাঁকা রাখুন)</label>
                <input type="date" name="ldate" />
                <button type="submit" className="btn-3d btn-primary" disabled={loading}>
                  {loading ? <div className="spinner-sm"></div> : 'তালিকায় নাম যোগ করুন'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      <ChatBot />

      <nav className="bottom-nav show-mobile glass">
        <li className={activeTab === 'home' ? 'active' : ''} onClick={() => setActiveTab('home')}>🏠</li>
        <li className={activeTab === 'list' ? 'active' : ''} onClick={() => setActiveTab('list')}>🔍</li>
        <li className={activeTab === 'add' ? 'active' : ''} onClick={() => setActiveTab('add')}>➕</li>
      </nav>
    </div>
  );
}

export default App;

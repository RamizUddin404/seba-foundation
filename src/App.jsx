import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import './App.css';

// --- Supabase Configuration ---
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_KEY = 'YOUR_SUPABASE_ANON_KEY';

// Check if keys are valid
const isSupabaseConfigured = SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_KEY !== 'YOUR_SUPABASE_ANON_KEY';
const supabase = isSupabaseConfigured ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

function App() {
  const [requests, setRequests] = useState(() => JSON.parse(localStorage.getItem('seba_requests_backup')) || []);
  const [users, setUsers] = useState(() => JSON.parse(localStorage.getItem('seba_users')) || [
    { email: 'admin@seba.com', password: 'admin', name: 'অ্যাডমিন', role: 'admin' }
  ]);
  const [currentUser, setCurrentUser] = useState(() => JSON.parse(localStorage.getItem('seba_current_user')) || null);
  const [activeTab, setActiveTab] = useState('home');
  const [loading, setLoading] = useState(false);
  const [filterGroup, setFilterGroup] = useState('All');

  const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  // --- Real Database Fetching ---
  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    if (!supabase) return;
    setLoading(true);
    try {
      let { data: blood_requests, error } = await supabase
        .from('blood_requests')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (!error && blood_requests) {
        setRequests(blood_requests);
        localStorage.setItem('seba_requests_backup', JSON.stringify(blood_requests));
      }
    } catch (err) {
      console.error("Supabase Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('seba_current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('seba_current_user');
    }
    localStorage.setItem('seba_users', JSON.stringify(users));
  }, [currentUser, users]);

  // --- Handlers ---
  const handleAuth = (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const pass = e.target.password.value;
    const user = users.find(u => u.email === email && u.password === pass);
    if (user) {
      setCurrentUser(user);
      setActiveTab('home');
    } else alert('ভুল ইমেইল বা পাসওয়ার্ড!');
  };

  const submitToDB = async (e) => {
    e.preventDefault();
    setLoading(true);
    const newReq = {
      id: Date.now(), // Fallback ID
      patient_name: e.target.pname.value,
      blood_group: e.target.bgroup.value,
      location: e.target.loc.value,
      phone: e.target.phone.value,
      posted_by: currentUser.email,
      status: 'Urgent',
      created_at: new Date().toISOString()
    };

    if (supabase) {
      const { data, error } = await supabase.from('blood_requests').insert([newReq]);
      if (!error) {
        alert('আবেদনটি সফলভাবে ডাটাবেসে সেভ হয়েছে! 🩸');
        fetchRequests();
        setActiveTab('live');
      } else {
        alert('ডাটাবেসে সেভ করতে সমস্যা হয়েছে, লোকাল স্টোরেজে সেভ করা হচ্ছে।');
        saveLocal(newReq);
      }
    } else {
      saveLocal(newReq);
      alert('লোকাল স্টোরেজে আবেদনটি সফলভাবে সেভ হয়েছে! 🩸');
      setActiveTab('live');
    }
    setLoading(false);
  };

  const saveLocal = (req) => {
    const updated = [req, ...requests];
    setRequests(updated);
    localStorage.setItem('seba_requests_backup', JSON.stringify(updated));
  };

  const deleteFromDB = async (id) => {
    if (!window.confirm('আপনি কি এই রিকোয়েস্টটি ডিলিট করতে চান?')) return;
    
    if (supabase) {
      const { error } = await supabase.from('blood_requests').delete().eq('id', id);
      if (!error) {
        fetchRequests();
        return;
      }
    }
    
    const updated = requests.filter(r => r.id !== id);
    setRequests(updated);
    localStorage.setItem('seba_requests_backup', JSON.stringify(updated));
  };

  // --- Style Constants ---
  const navPhotoStyle = { width: '35px', height: '35px', borderRadius: '50%', border: '2px solid #ff4757', objectFit: 'cover' };
  const profilePhotoStyle = { width: '90px', height: '90px', borderRadius: '50%', border: '4px solid #ff4757', objectFit: 'cover' };

  if (!currentUser) return (
    <div className="login-screen">
      <div className="login-card-modern">
        <h1>Seba / সেবা</h1>
        <p>রক্তদাতা ও গ্রহীতাদের ডিজিটাল প্ল্যাটফর্ম</p>
        <form onSubmit={handleAuth} className="modern-form">
          <input type="email" name="email" placeholder="আপনার ইমেইল" required />
          <input type="password" name="password" placeholder="পাসওয়ার্ড" required />
          <button type="submit" className="btn-login">লগইন করুন</button>
        </form>
        <p className="admin-hint">অ্যাডমিন লগইন: admin@seba.com / admin</p>
      </div>
    </div>
  );

  return (
    <div className="app-main">
      {loading && <div className="loader"></div>}
      
      <nav className="top-nav">
        <div className="nav-brand" onClick={() => setActiveTab('home')}>
          <span className="logo-icon">🩸</span>
          <div className="brand-txt"><h2>Seba</h2><span>Blood Bank</span></div>
        </div>
        <ul className="nav-menu">
          <li className={activeTab === 'home' ? 'active' : ''} onClick={() => setActiveTab('home')}>হোম</li>
          <li className={activeTab === 'request' ? 'active' : ''} onClick={() => setActiveTab('request')}>আবেদন</li>
          <li className={activeTab === 'live' ? 'active' : ''} onClick={() => setActiveTab('live')}>লাইভ লিস্ট</li>
          <li className={activeTab === 'profile' ? 'active' : ''} onClick={() => setActiveTab('profile')}>প্রোফাইল</li>
        </ul>
        <div className="nav-user" onClick={() => setActiveTab('profile')}>
          <img src={currentUser.photo || `https://ui-avatars.com/api/?name=${currentUser.name}`} style={navPhotoStyle} alt="me" />
        </div>
      </nav>

      <main className="content-view">
        {activeTab === 'home' && (
          <section className="hero-section">
            <div className="hero-text">
              <h1>রক্ত দিন, <span>জীবন বাঁচান</span></h1>
              <p>আপনার হাতের নাগালে হাজারো রক্তদাতা। সরাসরি ফেসবুক ও ওয়েবসাইট থেকে সহায়তা নিন।</p>
              <div className="hero-btns">
                <button className="btn-main" onClick={() => setActiveTab('request')}>রক্তের আবেদন</button>
                <button className="btn-glass" onClick={() => setActiveTab('live')}>লাইভ লিস্ট দেখুন</button>
              </div>
            </div>
            <div className="stats-container">
              <div className="s-box"><h3>{requests.length}</h3><p>মোট আবেদন</p></div>
              <div className="s-box"><h3>{users.length}</h3><p>সদস্য</p></div>
            </div>
          </section>
        )}

        {activeTab === 'request' && (
          <section className="form-page">
            <div className="form-card">
              <h2>রক্তের আবেদন ফরম</h2>
              <form onSubmit={submitToDB} className="blood-form">
                <div className="form-grid">
                  <div className="field"><label>রোগীর নাম</label><input name="pname" required /></div>
                  <div className="field">
                    <label>রক্তের গ্রুপ</label>
                    <select name="bgroup" required>
                      <option value="">সিলেক্ট করুন</option>
                      {bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}
                    </select>
                  </div>
                  <div className="field"><label>হাসপাতাল ও ঠিকানা</label><input name="loc" required /></div>
                  <div className="field"><label>মোবাইল নম্বর</label><input name="phone" type="tel" required /></div>
                </div>
                <button type="submit" className="btn-submit">আবেদনটি পোস্ট করুন</button>
              </form>
            </div>
          </section>
        )}

        {activeTab === 'live' && (
          <section className="list-page">
            <div className="list-header">
              <h2>লাইভ ব্লাড রিকোয়েস্টসমূহ</h2>
              <select onChange={(e) => setFilterGroup(e.target.value)} className="filter-select">
                <option value="All">সব গ্রুপ</option>
                {bloodGroups.map(bg => <option key={bg} value={bg}>{bg}</option>)}
              </select>
            </div>
            <div className="request-grid">
              {requests
                .filter(r => filterGroup === 'All' || r.blood_group === filterGroup)
                .map(req => (
                <div key={req.id} className="request-card-premium">
                  <div className="card-badge">{req.blood_group}</div>
                  <div className="card-body">
                    <h3>{req.patient_name}</h3>
                    <p>📍 {req.location}</p>
                    <p>📞 {req.phone}</p>
                  </div>
                  <div className="card-footer">
                    <button className="btn-call" onClick={() => window.open(`tel:${req.phone}`)}>সরাসরি কল দিন</button>
                    {(currentUser.role === 'admin' || currentUser.email === req.posted_by) && (
                      <button className="btn-remove" onClick={() => deleteFromDB(req.id)}>ডিলিট</button>
                    )}
                  </div>
                </div>
              ))}
              {requests.length === 0 && <p style={{textAlign: 'center', gridColumn: '1/-1', color: '#64748b'}}>বর্তমানে কোনো আবেদন নেই।</p>}
            </div>
          </section>
        )}

        {activeTab === 'profile' && (
          <section className="profile-section">
            <div className="profile-card-modern">
              <div className="p-header-top">
                <img src={currentUser.photo || `https://ui-avatars.com/api/?name=${currentUser.name}`} style={profilePhotoStyle} alt="user" />
                <div className="p-info">
                  <h2>{currentUser.name}</h2>
                  <p>{currentUser.email}</p>
                  <span className="role-chip">{currentUser.role}</span>
                </div>
              </div>
              <button className="btn-logout" onClick={() => setCurrentUser(null)}>লগআউট</button>
            </div>
          </section>
        )}
      </main>

      <footer className="main-footer">
        <p>&copy; 2026 Seba Blood Bank | মানবতার কল্যাণে আমরা সর্বদা প্রস্তুত।</p>
      </footer>
    </div>
  );
}

export default App;

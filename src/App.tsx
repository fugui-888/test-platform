import { Routes, Route, BrowserRouter, Navigate } from 'react-router-dom';
import { DataContextProvider } from './context/DataContext';
import NavButton from './components/NavButton';
import Analysis from './pages/Analysis';
// import Monitor from './pages/Monitor';

import './App.css';

export const routes = {
  // Monitor: 'monitor',
  Analysis: 'analysis',
};

export const Root = () => (
  <>
    <Routes>
      {/* <Route path={routes.Monitor} element={<Monitor />} /> */}
      <Route path={routes.Analysis} element={<Analysis />} />
      <Route path="/" element={<Navigate to={routes.Analysis} />} />
    </Routes>
  </>
);

function App() {
  return (
    <BrowserRouter>
      <div className="App">
        <DataContextProvider>
          <NavButton />
          <Root />
        </DataContextProvider>
      </div>
    </BrowserRouter>
  );
}

export default App;

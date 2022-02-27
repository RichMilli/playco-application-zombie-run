import './App.css';
import {PixiContainer} from '../pixi-container/PixiContainer';

function App() {
  return (
    <div className="App">
      <PixiContainer/>
      <div className="how-to">
        How to play: 
        <br/><br />
        Use the WASD keys to move. <br/>
        Try and save as many hospital staff from becoming zombies and get the highest score.
        <br /><br />
        See at GitHub: <a href="https://github.com/jacknkandy/playco-application-zombie-run">https://github.com/jacknkandy/playco-application-zombie-run</a>
      </div>
    </div>
  );
}

export default App;
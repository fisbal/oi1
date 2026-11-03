import { useState } from 'react';
import { Btn } from './kit';
import { autoPunctuation, setAutoPunctuation } from './dictation';

/** "Automatic punctuation" for dictation: full stops, question marks and new lines from the pauses (on by default). */
export function AutoPunctBtn() {
  const [on, setOn] = useState(autoPunctuation);
  return <Btn big icon="sparkle" title="dictation.auto" active={on} onClick={() => { setAutoPunctuation(!on); setOn(!on); }} />;
}

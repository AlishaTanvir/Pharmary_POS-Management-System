import React from 'react';
export function CashierKeyboardHelp(){
 return <section className="cashier-access-help"><p>Use these shortcuts in the online Point of sale. Checkout must be ready and no other dialog may be open. On some keyboards, hold Fn with the function key.</p><table><thead><tr><th>KEY</th><th>ACTION</th></tr></thead><tbody>{[
  ['F2','Focus medicine search / barcode scan'],
  ['F4','Focus the first cart quantity'],
  ['F6','Focus the customer account'],
  ['F8','Focus the discount; current limits and approval rules still apply'],
  ['F9','Review payment for a nonempty cart'],
  ['Ctrl+P / Command+P','Print the open saved receipt using the Print receipt action'],
  ['Escape','Close this workspace dialog when no operation is in progress'],
  ['Tab / Shift+Tab','Move between controls; an open dialog keeps focus inside']
 ].map(([key,description])=><tr key={key}><th scope="row"><kbd>{key}</kbd></th><td>{description}</td></tr>)}</tbody></table><p>F9 reviews payment; confirm separately to post. Closing returns focus to your previous control or the workspace. Outside receipts, Ctrl+P keeps its browser behavior.</p></section>;
}

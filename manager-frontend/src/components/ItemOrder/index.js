import React from 'react';

export default function ItemLine( props ) {
  return (
      <div className="order-info">
        <h3><span>{props.quantity}x </span>{props.itemName}</h3>
      </div>
  )
}

import React from 'react'
import Header from './Header';
import TableRow from './TableRow';
import './style.css';

type Props = {
    cols: string[],
    items: any[],
};

const Table = (props: Props) => {

    const cols: string[] = props.cols;
    const items = props.items;

    if (!items) return null;

    

    return <table cellPadding={0} cellSpacing={0} className="data-table" >
        
        {
            cols && 
            cols.length > 0 &&
            <Header cols={cols} />
        }

        <tbody>
            {
                items.map((item: any, itemIndex: number ) => (
                    <TableRow key={itemIndex} item={item} cols={cols} />
                ))
            }
        </tbody>
    </table>
    
};

export default Table;

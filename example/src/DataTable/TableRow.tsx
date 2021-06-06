import React from 'react';

const TableRow = (props: any) => {
    
    const item = props.item;
    const cols = props.cols;

    const isArray = Array.isArray(item);

    return (
        <tr className="no-text-overflow">

            {
                isArray &&
                item.map((value: any, index: number) => {
                    return <td key={cols[index]}>
                        {
                            typeof value === 'number' &&
                            value.toFixed(0)
                        }
                    </td>
                })   
            }

            {
                !isArray &&
                cols.map((c: any, index: number) => {
                    return <td key={cols[index]}>
                        {
                            typeof item[c] === 'number' &&
                            item[c].toFixed(0)
                        }
                    </td>
                })
            }
        </tr>
    )
}

export default TableRow;
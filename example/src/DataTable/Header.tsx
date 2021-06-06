import React from 'react';

const Header = (props: any) => {
    
    const cols = props.cols || [];

    return <thead>
        <tr>
            {
                cols.map((c: any, index: number) => {
                    return <th key={index}>{c}</th>
                })
            }
        </tr>
    </thead>
}

export default Header;
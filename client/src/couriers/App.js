import React from 'react';
import requiresAuth from '../global/requiresAuth';
import CouriersTable from './CouriersTable';

export class App extends React.Component {
    constructor(props) {
        super(props);
    }
    
    render() {
        return (
            <CouriersTable />
        );
    }
}

export default requiresAuth(App);

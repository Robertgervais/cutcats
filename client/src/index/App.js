import React from 'react';
import requiresAuth from '../global/requiresAuth';
import { hot } from 'react-hot-loader';
import '../global/global.scss';
import 'bootstrap/dist/css/bootstrap.css';
import 'font-awesome/css/font-awesome.css';

export class App extends React.Component {
    constructor(props) {
        super(props);

        window.location.replace('/closeshift');
    }

    render() {
        return null;
    }
}

export default hot(module)(requiresAuth(App));

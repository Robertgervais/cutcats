import React from 'react';
import PropTypes from 'prop-types';

export default class Uploader extends React.Component {
  constructor(props) {
    super(props);

    this.handleChange = this.handleChange.bind(this);
  }

  handleChange (e) {
    if (!e.target.files.length) {
      return;
    }
    
    const file = e.target.files[0];
    const data = new FormData();
    data.append('file', file);
    const reqOptions = { credentials: 'include', body: data, method: 'post' };
    
    fetch(this.props.validationUrl, reqOptions)
      .then(res => {
        if (res.ok) {
          return this.props.onValidationSuccess(file);
        } else {
          return res.text()
            .then(text => {
              const errorMessages = (text || '').split('\n');
              return this.props.onValidationFailure(errorMessages, file);
            });
        }
      });
  }
  
  render() {
    return (
      <div>
        <input type="file" accept=".csv" onChange={this.handleChange} />
      </div>
    );
  }
}

Uploader.propTypes = {
  validationUrl: PropTypes.string.isRequired,
  onValidationSuccess: PropTypes.func.isRequired,
  onValidationFailure: PropTypes.func.isRequired,
  onError: PropTypes.func.isRequired
};

import React from 'react';
import PropTypes from 'prop-types';
import {
    Button,
    Form,
    FormGroup,
    Label,
    Input,
    FormText,
    ModalHeader,
    ModalBody,
    ModalFooter
} from 'reactstrap';

export default class CourierForm extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            courier: this.props.courier || {}
        };

        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);
    }

    handleChange(e) {
        let fieldName = e.target.name;
        let fieldValue = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        
        this.setState({
            courier: {
                ...this.state.courier,
                [fieldName]: fieldValue
            }
        });
    }

    handleSubmit(e) {
        e.preventDefault();
        return this.props.onSubmit(this.state.courier);
    }

    render() {
        return (
            <Form onSubmit={this.handleSubmit}>
              <ModalHeader>
                {this.props.courier ? this.props.courier.name : 'New Courier'}
              </ModalHeader>
              <ModalBody>
                <FormGroup>
                  <Label for='name'>Name</Label>
                  <Input id='name' type='text' name='name' value={this.state.courier.name || ''} onChange={this.handleChange} autoFocus />
                </FormGroup>
                <FormGroup>
                  <Label for='radioCallNumber'>Radio Call Number</Label>
                  <Input id='radioCallNumber' type='text' name='radioCallNumber' value={this.state.courier.radioCallNumber || ''} onChange={this.handleChange} />
                </FormGroup>
                <FormGroup>
                  <Label for='phone'>Phone</Label>
                  <Input id='phone' type='text' name='phone' value={this.state.courier.phone || ''} onChange={this.handleChange} />
                </FormGroup>
                <FormGroup>
                  <Label for='email'>Email</Label>
                  <Input id='email' type='text' name='email' value={this.state.courier.email || ''} onChange={this.handleChange} />
                </FormGroup>
                <FormGroup>
                  <Label for='status'>Status</Label>
                  <Input id='status' type='select' name='status' value={this.state.courier.status || ''} onChange={this.handleChange}>
                    <option value=''></option>
                    <option value='member' >Member</option>
                    <option value='guest'>Guest</option>
                  </Input>
                </FormGroup>
              </ModalBody>
              <ModalFooter>
                {this.props.errorMessage &&
                    <div className='text-danger mr-auto'>
                      <i className='fa fa-exclamation-circle mr-2' />
                      {this.props.errorMessage}
                    </div>
                }
                <Button type='submit' color='primary'>Save</Button>
                <Button color='link' onClick={this.props.onCancel}>Cancel</Button>
              </ModalFooter>
            </Form>
        );
    }
}

CourierForm.propTypes = {
    onSubmit: PropTypes.func.isRequired,
    onCancel: PropTypes.func.isRequired,
    courier: PropTypes.object,
    errorMessage: PropTypes.string
};
